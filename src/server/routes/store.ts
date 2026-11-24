import crypto from 'crypto';
import { Router } from 'express';
import { eq, desc, and, inArray, sql } from 'drizzle-orm';
import { db } from '../../db/index.ts';
import {
  stores,
  storeFollowers,
  storeProducts,
  storeFavorites,
  storeCartItems,
  storeOrders,
  storeReviews,
  users,
} from '../../db/schema.ts';
import { requireAuth, optionalAuth, AuthRequest } from '../../middleware/auth.ts';
import { createNotification } from '../notify.ts';
import { uploadMiddleware } from '../upload.ts';

const router = Router();

function makeTransferRef() {
  return `TGR-${crypto.randomBytes(3).toString('hex').toUpperCase()}`;
}

function isValidUploadUrl(url: string): boolean {
  return typeof url === 'string' && /^\/uploads\/[a-zA-Z0-9._-]+$/.test(url.trim());
}

// List stores & products + viewer cart/favorites
router.get('/catalog', optionalAuth, async (req: AuthRequest, res) => {
  try {
    const category = String(req.query.category || 'all').toLowerCase();
    const search = String(req.query.q || '').trim().toLowerCase();
    const sort = String(req.query.sort || 'latest');

    const [allStores, allProducts] = await Promise.all([
      db.select().from(stores).orderBy(desc(stores.createdAt)).limit(50),
      db.select().from(storeProducts).orderBy(desc(storeProducts.isFeatured), desc(storeProducts.createdAt)).limit(100),
    ]);

    let filteredProducts = allProducts;
    if (category && category !== 'all') {
      filteredProducts = filteredProducts.filter((p) => p.category.toLowerCase() === category);
    }
    if (search) {
      filteredProducts = filteredProducts.filter(
        (p) => p.title.toLowerCase().includes(search) || (p.description || '').toLowerCase().includes(search)
      );
    }
    if (sort === 'price_asc') filteredProducts = [...filteredProducts].sort((a, b) => a.priceUsd - b.priceUsd);
    if (sort === 'price_desc') filteredProducts = [...filteredProducts].sort((a, b) => b.priceUsd - a.priceUsd);
    if (sort === 'rating') filteredProducts = [...filteredProducts].sort((a, b) => b.ratingAvg - a.ratingAvg);

    const viewerId = req.dbUser?.id;
    const [favorites, cart, storeFollows] = viewerId
      ? await Promise.all([
          db.select().from(storeFavorites).where(eq(storeFavorites.userId, viewerId)),
          db.select().from(storeCartItems).where(eq(storeCartItems.userId, viewerId)),
          db.select().from(storeFollowers).where(eq(storeFollowers.userId, viewerId)),
        ])
      : [[], [], []];

    const storeMap = new Map(allStores.map((s) => [s.id, s]));
    const favSet = new Set(favorites.map((f) => f.productId));
    const followSet = new Set(storeFollows.map((f) => f.storeId));

    res.json({
      stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
      stores: allStores.map((s) => ({ ...s, isFollowing: followSet.has(s.id) })),
      products: filteredProducts.map((p) => ({
        ...p,
        store: storeMap.get(p.storeId) || null,
        isFavorite: favSet.has(p.id),
      })),
      cartItems: cart.map((c) => {
        const prod = allProducts.find((p) => p.id === c.productId) || null;
        return {
          ...c,
          product: prod ? { ...prod, store: storeMap.get(prod.storeId) || null } : null,
        };
      }),
    });
  } catch (err) {
    console.error('GET /api/store/catalog failed:', err);
    res.status(500).json({ error: 'Failed to load store catalog' });
  }
});

// Create Store (with Seller Bank Account Details for Bank Transfer Payments)
router.post('/stores', requireAuth, async (req: AuthRequest, res) => {
  try {
    const {
      name,
      description,
      category,
      bankName,
      accountHolderName,
      iban,
      accountNumber,
      bankNotes,
    } = req.body || {};
    if (!name?.trim()) return res.status(400).json({ error: 'Store name required' });

    const [created] = await db
      .insert(stores)
      .values({
        ownerId: req.dbUser!.id,
        name: String(name).trim().slice(0, 100),
        description: String(description || '').slice(0, 600),
        category: String(category || 'tech').slice(0, 40),
        bankName: String(bankName || '').trim().slice(0, 100),
        accountHolderName: String(accountHolderName || '').trim().slice(0, 120),
        iban: String(iban || '').replace(/\s+/g, '').toUpperCase().slice(0, 48),
        accountNumber: String(accountNumber || '').trim().slice(0, 48),
        bankNotes: String(bankNotes || '').trim().slice(0, 300),
        coverUrl: '/src/assets/images/tiger_default_cover_1795106934343.jpg',
      })
      .returning();

    res.status(201).json({ store: created });
  } catch (err) {
    console.error('POST /api/store/stores failed:', err);
    res.status(500).json({ error: 'Failed to create store' });
  }
});

// Update Store Details & Bank Account
router.patch('/stores/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const storeId = Number(req.params.id);
    const [existing] = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
    if (!existing || existing.ownerId !== req.dbUser!.id) {
      return res.status(403).json({ error: 'Not authorized to edit this store' });
    }

    const {
      name,
      description,
      category,
      bankName,
      accountHolderName,
      iban,
      accountNumber,
      bankNotes,
    } = req.body || {};

    const updates: Record<string, unknown> = {};
    if (typeof name === 'string' && name.trim()) updates.name = name.trim().slice(0, 100);
    if (typeof description === 'string') updates.description = description.slice(0, 600);
    if (typeof category === 'string' && category.trim()) updates.category = category.trim().slice(0, 40);
    if (typeof bankName === 'string') updates.bankName = bankName.trim().slice(0, 100);
    if (typeof accountHolderName === 'string') updates.accountHolderName = accountHolderName.trim().slice(0, 120);
    if (typeof iban === 'string') updates.iban = iban.replace(/\s+/g, '').toUpperCase().slice(0, 48);
    if (typeof accountNumber === 'string') updates.accountNumber = accountNumber.trim().slice(0, 48);
    if (typeof bankNotes === 'string') updates.bankNotes = bankNotes.trim().slice(0, 300);

    const [updated] = await db.update(stores).set(updates).where(eq(stores.id, storeId)).returning();
    res.json({ store: updated });
  } catch (err) {
    console.error('PATCH /api/store/stores/:id failed:', err);
    res.status(500).json({ error: 'Failed to update store' });
  }
});

// Follow Store
router.post('/stores/:id/follow', requireAuth, async (req: AuthRequest, res) => {
  try {
    const storeId = Number(req.params.id);
    const userId = req.dbUser!.id;
    const [existing] = await db
      .select()
      .from(storeFollowers)
      .where(and(eq(storeFollowers.storeId, storeId), eq(storeFollowers.userId, userId)))
      .limit(1);

    if (existing) {
      await db.delete(storeFollowers).where(eq(storeFollowers.id, existing.id));
      await db
        .update(stores)
        .set({ followersCount: sql`GREATEST(0, ${stores.followersCount} - 1)` })
        .where(eq(stores.id, storeId));
      return res.json({ following: false });
    }

    await db.insert(storeFollowers).values({ storeId, userId });
    await db
      .update(stores)
      .set({ followersCount: sql`${stores.followersCount} + 1` })
      .where(eq(stores.id, storeId));
    res.json({ following: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to follow store' });
  }
});

// Add Product (with per-product delivery fee & accepted payment methods)
router.post('/products', requireAuth, async (req: AuthRequest, res) => {
  try {
    const {
      storeId,
      title,
      description,
      category,
      priceUsd,
      deliveryFeeUsd,
      allowCod,
      allowBankTransfer,
      discountPercent,
      stock,
      images,
      isFeatured,
    } = req.body || {};
    const [store] = await db.select().from(stores).where(eq(stores.id, Number(storeId))).limit(1);
    if (!store || store.ownerId !== req.dbUser!.id) {
      return res.status(403).json({ error: 'You must own this store to add products' });
    }
    if (!title?.trim() || !(Number(priceUsd) > 0)) {
      return res.status(400).json({ error: 'Valid product title and price are required' });
    }

    const codFlag = allowCod === undefined ? true : Boolean(allowCod);
    const bankFlag = allowBankTransfer === undefined ? true : Boolean(allowBankTransfer);
    if (!codFlag && !bankFlag) {
      return res.status(400).json({ error: 'At least one payment method must be enabled for the product' });
    }

    const cleanDeliveryFee = Math.max(0, Math.min(10000, Number(deliveryFeeUsd || 0)));

    const [created] = await db
      .insert(storeProducts)
      .values({
        storeId: store.id,
        sellerId: req.dbUser!.id,
        title: String(title).trim().slice(0, 120),
        description: String(description || '').slice(0, 1500),
        category: String(category || 'tech').slice(0, 40),
        priceUsd: Number(Number(priceUsd).toFixed(2)),
        deliveryFeeUsd: Number(cleanDeliveryFee.toFixed(2)),
        allowCod: codFlag,
        allowBankTransfer: bankFlag,
        discountPercent: Math.max(0, Math.min(90, Number(discountPercent || 0))),
        stock: Math.max(0, Number(stock ?? 10)),
        images: Array.isArray(images) ? images.slice(0, 6).map(String) : [],
        isFeatured: Boolean(isFeatured),
      })
      .returning();

    res.status(201).json({ product: created });
  } catch (err) {
    console.error('POST /api/store/products failed:', err);
    res.status(500).json({ error: 'Failed to create product' });
  }
});

// Update Product (Stock / Price / Discount / Delivery Fee / Payment Options)
router.patch('/products/:id', requireAuth, async (req: AuthRequest, res) => {
  try {
    const productId = Number(req.params.id);
    const [prod] = await db.select().from(storeProducts).where(eq(storeProducts.id, productId)).limit(1);
    if (!prod || prod.sellerId !== req.dbUser!.id) {
      return res.status(403).json({ error: 'Not authorized to edit this product' });
    }
    const { title, description, priceUsd, deliveryFeeUsd, allowCod, allowBankTransfer, discountPercent, stock } = req.body || {};
    const updates: Record<string, unknown> = {};
    if (typeof title === 'string' && title.trim()) updates.title = title.trim().slice(0, 120);
    if (typeof description === 'string') updates.description = description.slice(0, 1500);
    if (typeof priceUsd === 'number' && priceUsd > 0) updates.priceUsd = Number(priceUsd.toFixed(2));
    if (typeof deliveryFeeUsd === 'number' && deliveryFeeUsd >= 0) updates.deliveryFeeUsd = Number(deliveryFeeUsd.toFixed(2));
    if (typeof allowCod === 'boolean') updates.allowCod = allowCod;
    if (typeof allowBankTransfer === 'boolean') updates.allowBankTransfer = allowBankTransfer;
    if (typeof discountPercent === 'number') updates.discountPercent = Math.max(0, Math.min(90, discountPercent));
    if (typeof stock === 'number' && stock >= 0) updates.stock = Math.round(stock);

    const [updated] = await db.update(storeProducts).set(updates).where(eq(storeProducts.id, productId)).returning();
    res.json({ product: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update product' });
  }
});

// Upload Transfer or Refund Receipt (Image or PDF)
router.post('/receipts/upload', requireAuth, uploadMiddleware.single('file'), async (req: AuthRequest, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ error: 'Receipt image or PDF file is required' });
    }
    res.status(201).json({
      url: `/uploads/${req.file.filename}`,
      originalName: req.file.originalname,
      mimeType: req.file.mimetype,
    });
  } catch (err) {
    console.error('POST /api/store/receipts/upload failed:', err);
    res.status(500).json({ error: 'Failed to upload receipt' });
  }
});

// Favorites
router.post('/products/:id/favorite', requireAuth, async (req: AuthRequest, res) => {
  try {
    const productId = Number(req.params.id);
    const userId = req.dbUser!.id;
    const [existing] = await db
      .select()
      .from(storeFavorites)
      .where(and(eq(storeFavorites.userId, userId), eq(storeFavorites.productId, productId)))
      .limit(1);
    if (existing) {
      await db.delete(storeFavorites).where(eq(storeFavorites.id, existing.id));
      return res.json({ favorite: false });
    }
    await db.insert(storeFavorites).values({ userId, productId });
    res.json({ favorite: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to toggle favorite' });
  }
});

// Reviews & Ratings
router.get('/products/:id/reviews', async (req, res) => {
  try {
    const productId = Number(req.params.id);
    const list = await db
      .select()
      .from(storeReviews)
      .where(eq(storeReviews.productId, productId))
      .orderBy(desc(storeReviews.createdAt));
    const uIds = Array.from(new Set(list.map((r) => r.userId)));
    const uRows = uIds.length ? await db.select().from(users).where(inArray(users.id, uIds)) : [];
    const uMap = new Map(uRows.map((u) => [u.id, { displayName: u.displayName, username: u.username, avatarUrl: u.avatarUrl }]));
    res.json({ reviews: list.map((r) => ({ ...r, author: uMap.get(r.userId) || null })) });
  } catch (err) {
    res.status(500).json({ error: 'Failed to load reviews' });
  }
});

router.post('/products/:id/reviews', requireAuth, async (req: AuthRequest, res) => {
  try {
    const productId = Number(req.params.id);
    const rating = Math.max(1, Math.min(5, Math.round(Number(req.body?.rating || 5))));
    const comment = String(req.body?.comment || '').trim().slice(0, 600);

    const [created] = await db
      .insert(storeReviews)
      .values({ productId, userId: req.dbUser!.id, rating, comment })
      .returning();

    const [{ avg, count }] = await db
      .select({
        avg: sql<number>`coalesce(avg(${storeReviews.rating}), 0)::float`,
        count: sql<number>`count(*)::int`,
      })
      .from(storeReviews)
      .where(eq(storeReviews.productId, productId));

    await db
      .update(storeProducts)
      .set({ ratingAvg: Number(avg.toFixed(1)), reviewsCount: count })
      .where(eq(storeProducts.id, productId));

    res.status(201).json({ review: created });
  } catch (err) {
    res.status(500).json({ error: 'Failed to post review' });
  }
});

// Cart CRUD
router.post('/cart', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const productId = Number(req.body?.productId);
    const quantity = Math.max(1, Math.min(50, Math.round(Number(req.body?.quantity || 1))));
    const [prod] = await db.select().from(storeProducts).where(eq(storeProducts.id, productId)).limit(1);
    if (!prod || prod.stock < 1) return res.status(400).json({ error: 'Product unavailable or out of stock' });

    const [item] = await db
      .insert(storeCartItems)
      .values({ userId, productId, quantity })
      .onConflictDoUpdate({
        target: [storeCartItems.userId, storeCartItems.productId],
        set: { quantity },
      })
      .returning();
    res.json({ item });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update cart' });
  }
});

router.delete('/cart/:productId', requireAuth, async (req: AuthRequest, res) => {
  try {
    const productId = Number(req.params.productId);
    await db
      .delete(storeCartItems)
      .where(and(eq(storeCartItems.userId, req.dbUser!.id), eq(storeCartItems.productId, productId)));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: 'Failed to remove cart item' });
  }
});

// Direct Product Purchase ("شراء الآن") — Supports Cash on Delivery OR Bank Transfer + Receipt Upload
router.post('/orders/direct', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const {
      productId,
      quantity,
      shippingAddress,
      note,
      paymentMethod,
      selectedBankApp,
      transferReference,
      transferredAmountUsd,
      transferReceiptUrl,
    } = req.body || {};

    if (!shippingAddress?.trim()) {
      return res.status(400).json({ error: 'Shipping address or contact info is required' });
    }
    const qty = Math.max(1, Math.min(50, Math.round(Number(quantity || 1))));
    const [prod] = await db.select().from(storeProducts).where(eq(storeProducts.id, Number(productId))).limit(1);
    if (!prod) return res.status(404).json({ error: 'Product not found' });
    if (prod.stock < qty) return res.status(400).json({ error: `Insufficient stock for ${prod.title}` });

    const method = paymentMethod === 'bank_transfer' ? 'bank_transfer' : 'cod';
    if (method === 'cod' && !prod.allowCod) {
      return res.status(400).json({ error: 'This product does not support Cash on Delivery' });
    }
    if (method === 'bank_transfer' && !prod.allowBankTransfer) {
      return res.status(400).json({ error: 'This product does not support online bank transfer' });
    }

    const [storeRow] = await db.select().from(stores).where(eq(stores.id, prod.storeId)).limit(1);
    if (!storeRow) return res.status(404).json({ error: 'Store not found' });

    if (method === 'bank_transfer') {
      if (!storeRow.iban && !storeRow.accountNumber) {
        return res.status(400).json({ error: 'Seller has not configured bank account details for transfers yet' });
      }
      if (!isValidUploadUrl(transferReceiptUrl)) {
        return res.status(400).json({ error: 'Please upload your bank transfer receipt to confirm your order' });
      }
    }

    const discounted = Number((prod.priceUsd * (1 - (prod.discountPercent || 0) / 100)).toFixed(2));
    const subtotalUsd = Number((discounted * qty).toFixed(2));
    const deliveryFeeUsd = Number((prod.deliveryFeeUsd || 0).toFixed(2));
    const totalUsd = Number((subtotalUsd + deliveryFeeUsd).toFixed(2));

    const cleanTransferred =
      method === 'bank_transfer' ? Math.max(0, Number(Number(transferredAmountUsd ?? totalUsd).toFixed(2))) : 0;
    const isPartial = method === 'bank_transfer' && cleanTransferred + 0.01 < totalUsd;

    const paymentStatus =
      method === 'cod'
        ? 'cod_pending'
        : isPartial
        ? 'refund_required'
        : 'receipt_uploaded';

    const refCode = String(transferReference || makeTransferRef()).trim().slice(0, 40);

    const [order] = await db
      .insert(storeOrders)
      .values({
        buyerId: userId,
        storeId: storeRow.id,
        items: [{ productId: prod.id, title: prod.title, priceUsd: discounted, deliveryFeeUsd, quantity: qty }],
        subtotalUsd,
        deliveryFeeUsd,
        totalUsd,
        status: 'pending',
        shippingAddress: String(shippingAddress).trim().slice(0, 400),
        paymentMethod: method,
        paymentStatus,
        selectedBankApp: method === 'bank_transfer' ? String(selectedBankApp || '').slice(0, 60) : '',
        transferReference: method === 'bank_transfer' ? refCode : '',
        transferredAmountUsd: cleanTransferred,
        transferReceiptUrl: method === 'bank_transfer' ? String(transferReceiptUrl).trim() : '',
        note: String(note || '').slice(0, 300),
      })
      .returning();

    await db
      .update(storeProducts)
      .set({ stock: sql`GREATEST(0, ${storeProducts.stock} - ${qty})` })
      .where(eq(storeProducts.id, prod.id));

    await createNotification({
      userId: storeRow.ownerId,
      actorId: userId,
      type: 'store',
      title:
        method === 'bank_transfer' && isPartial
          ? `تحويل بنكي ناقص على طلب #${order.id}`
          : `طلب جديد في متجر ${storeRow.name}`,
      body:
        method === 'bank_transfer'
          ? `تحويل بنكي $${cleanTransferred} من أصل $${totalUsd} (شامل التوصيل $${deliveryFeeUsd})`
          : `دفع عند الاستلام بقيمة $${totalUsd} (شامل التوصيل $${deliveryFeeUsd})`,
      entityType: 'order',
      entityId: order.id,
    });

    res.status(201).json({ order });
  } catch (err) {
    console.error('POST /api/store/orders/direct failed:', err);
    res.status(500).json({ error: 'Failed to place direct order' });
  }
});

// Place Cart Orders (COD or Bank Transfer)
router.post('/orders/checkout', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const {
      shippingAddress,
      note,
      paymentMethod,
      selectedBankApp,
      transferReference,
      transferredAmountUsd,
      transferReceiptUrl,
    } = req.body || {};
    if (!shippingAddress?.trim()) return res.status(400).json({ error: 'Shipping address or contact info is required' });

    const cartRows = await db.select().from(storeCartItems).where(eq(storeCartItems.userId, userId));
    if (cartRows.length === 0) return res.status(400).json({ error: 'Cart is empty' });

    const prodIds = cartRows.map((c) => c.productId);
    const prods = await db.select().from(storeProducts).where(inArray(storeProducts.id, prodIds));
    const pMap = new Map(prods.map((p) => [p.id, p]));

    const method = paymentMethod === 'bank_transfer' ? 'bank_transfer' : 'cod';

    const byStore = new Map<
      number,
      Array<{ productId: number; title: string; priceUsd: number; deliveryFeeUsd: number; quantity: number }>
    >();

    for (const c of cartRows) {
      const p = pMap.get(c.productId);
      if (!p || p.stock < c.quantity) {
        return res.status(400).json({ error: `Insufficient stock for ${p?.title || 'product'}` });
      }
      if (method === 'cod' && !p.allowCod) {
        return res.status(400).json({ error: `${p.title} does not allow Cash on Delivery` });
      }
      if (method === 'bank_transfer' && !p.allowBankTransfer) {
        return res.status(400).json({ error: `${p.title} does not allow Bank Transfer` });
      }
      const discounted = Number((p.priceUsd * (1 - (p.discountPercent || 0) / 100)).toFixed(2));
      const arr = byStore.get(p.storeId) || [];
      arr.push({
        productId: p.id,
        title: p.title,
        priceUsd: discounted,
        deliveryFeeUsd: Number((p.deliveryFeeUsd || 0).toFixed(2)),
        quantity: c.quantity,
      });
      byStore.set(p.storeId, arr);
    }

    if (method === 'bank_transfer') {
      if (byStore.size > 1) {
        return res.status(400).json({
          error: 'Online bank transfer checkout applies to one store at a time. Please order per store or use Cash on Delivery.',
        });
      }
      if (!isValidUploadUrl(transferReceiptUrl)) {
        return res.status(400).json({ error: 'Please upload your bank transfer receipt before submitting' });
      }
    }

    const createdOrders = [];

    for (const [storeId, items] of byStore.entries()) {
      const [storeRow] = await db.select().from(stores).where(eq(stores.id, storeId)).limit(1);
      if (method === 'bank_transfer' && (!storeRow || (!storeRow.iban && !storeRow.accountNumber))) {
        return res.status(400).json({ error: `Store ${storeRow?.name || ''} has no bank account configured` });
      }

      const subtotalUsd = Number(items.reduce((acc, i) => acc + i.priceUsd * i.quantity, 0).toFixed(2));
      const deliveryFeeUsd = Number(items.reduce((acc, i) => acc + (i.deliveryFeeUsd || 0), 0).toFixed(2));
      const totalUsd = Number((subtotalUsd + deliveryFeeUsd).toFixed(2));

      const cleanTransferred =
        method === 'bank_transfer' ? Math.max(0, Number(Number(transferredAmountUsd ?? totalUsd).toFixed(2))) : 0;
      const isPartial = method === 'bank_transfer' && cleanTransferred + 0.01 < totalUsd;
      const paymentStatus =
        method === 'cod'
          ? 'cod_pending'
          : isPartial
          ? 'refund_required'
          : 'receipt_uploaded';

      const [order] = await db
        .insert(storeOrders)
        .values({
          buyerId: userId,
          storeId,
          items,
          subtotalUsd,
          deliveryFeeUsd,
          totalUsd,
          status: 'pending',
          shippingAddress: String(shippingAddress).trim().slice(0, 400),
          paymentMethod: method,
          paymentStatus,
          selectedBankApp: method === 'bank_transfer' ? String(selectedBankApp || '').slice(0, 60) : '',
          transferReference: method === 'bank_transfer' ? String(transferReference || makeTransferRef()).slice(0, 40) : '',
          transferredAmountUsd: cleanTransferred,
          transferReceiptUrl: method === 'bank_transfer' ? String(transferReceiptUrl).trim() : '',
          note: String(note || '').slice(0, 300),
        })
        .returning();
      createdOrders.push(order);

      for (const item of items) {
        await db
          .update(storeProducts)
          .set({ stock: sql`GREATEST(0, ${storeProducts.stock} - ${item.quantity})` })
          .where(eq(storeProducts.id, item.productId));
      }

      if (storeRow) {
        await createNotification({
          userId: storeRow.ownerId,
          actorId: userId,
          type: 'store',
          title:
            method === 'bank_transfer' && isPartial
              ? `تحويل بنكي ناقص على طلب #${order.id}`
              : `طلب جديد في متجر ${storeRow.name}`,
          body:
            method === 'bank_transfer'
              ? `إيصال تحويل $${cleanTransferred} من أصل $${totalUsd}`
              : `طلب بقيمة $${totalUsd} (الدفع عند الاستلام)`,
          entityType: 'order',
          entityId: order.id,
        });
      }
    }

    await db.delete(storeCartItems).where(eq(storeCartItems.userId, userId));

    res.status(201).json({
      orders: createdOrders,
      stripeConfigured: Boolean(process.env.STRIPE_SECRET_KEY),
    });
  } catch (err) {
    console.error('POST /api/store/orders/checkout failed:', err);
    res.status(500).json({ error: 'Failed to place order' });
  }
});

// My Buyer Orders & Seller Orders (enriched with store bank details & buyer name)
router.get('/orders', requireAuth, async (req: AuthRequest, res) => {
  try {
    const userId = req.dbUser!.id;
    const myStores = await db.select().from(stores).where(eq(stores.ownerId, userId));
    const myStoreIds = myStores.map((s) => s.id);

    const [buyerOrders, sellerOrders] = await Promise.all([
      db.select().from(storeOrders).where(eq(storeOrders.buyerId, userId)).orderBy(desc(storeOrders.createdAt)),
      myStoreIds.length
        ? db.select().from(storeOrders).where(inArray(storeOrders.storeId, myStoreIds)).orderBy(desc(storeOrders.createdAt))
        : Promise.resolve([]),
    ]);

    const storeIds = Array.from(new Set([...buyerOrders, ...sellerOrders].map((o) => o.storeId)));
    const buyerIds = Array.from(new Set(sellerOrders.map((o) => o.buyerId)));

    const [relatedStores, relatedBuyers] = await Promise.all([
      storeIds.length ? db.select().from(stores).where(inArray(stores.id, storeIds)) : Promise.resolve([]),
      buyerIds.length ? db.select().from(users).where(inArray(users.id, buyerIds)) : Promise.resolve([]),
    ]);

    const storeMap = new Map(relatedStores.map((s) => [s.id, s]));
    const buyerMap = new Map(
      relatedBuyers.map((u) => [u.id, { id: u.id, displayName: u.displayName, username: u.username }])
    );

    res.json({
      buyerOrders: buyerOrders.map((o) => ({ ...o, store: storeMap.get(o.storeId) || null })),
      sellerOrders: sellerOrders.map((o) => ({
        ...o,
        store: storeMap.get(o.storeId) || null,
        buyer: buyerMap.get(o.buyerId) || null,
      })),
      myStores,
    });
  } catch (err) {
    console.error('GET /api/store/orders failed:', err);
    res.status(500).json({ error: 'Failed to load orders' });
  }
});

// Seller Payment Verification & Partial-Payment Refund Cancellation
router.patch('/orders/:id/payment-review', requireAuth, async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.id);
    const { action, refundAmountUsd, refundReceiptUrl, refundNote } = req.body || {};
    if (action !== 'confirm_payment' && action !== 'cancel_and_refund') {
      return res.status(400).json({ error: 'Invalid payment review action' });
    }

    const [order] = await db.select().from(storeOrders).where(eq(storeOrders.id, orderId)).limit(1);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const [store] = await db.select().from(stores).where(eq(stores.id, order.storeId)).limit(1);
    if (!store || store.ownerId !== req.dbUser!.id) {
      return res.status(403).json({ error: 'Only the store owner can review payment and refunds' });
    }

    if (action === 'confirm_payment') {
      const nextStatus = order.status === 'pending' ? 'confirmed' : order.status;
      const [updated] = await db
        .update(storeOrders)
        .set({
          paymentStatus: 'paid',
          status: nextStatus,
          updatedAt: new Date(),
        })
        .where(eq(storeOrders.id, orderId))
        .returning();

      await createNotification({
        userId: order.buyerId,
        actorId: req.dbUser!.id,
        type: 'store',
        title: `تأكيد الدفع للطلب #${order.id}`,
        body: `أكد البائع استلام المبلغ الكامل ($${order.totalUsd}) وتم اعتماد طلبك.`,
        entityType: 'order',
        entityId: order.id,
      });

      return res.json({ order: updated });
    }

    // Cancel & refund partial/transferred amount
    const defaultRefund = order.transferredAmountUsd > 0 ? order.transferredAmountUsd : 0;
    const cleanRefund = Math.max(0, Number(Number(refundAmountUsd ?? defaultRefund).toFixed(2)));
    const cleanReceipt = isValidUploadUrl(refundReceiptUrl) ? String(refundReceiptUrl).trim() : '';
    const cleanNote = String(
      refundNote || 'تم إلغاء الطلب لعدم اكتمال المبلغ المطلوب وإرجاع المبلغ المحوّل مسبقاً.'
    )
      .trim()
      .slice(0, 400);

    const wasAlreadyCancelled = order.status === 'cancelled';

    const [updated] = await db
      .update(storeOrders)
      .set({
        status: 'cancelled',
        paymentStatus: 'refunded',
        refundAmountUsd: cleanRefund,
        refundReceiptUrl: cleanReceipt,
        refundNote: cleanNote,
        updatedAt: new Date(),
      })
      .where(eq(storeOrders.id, orderId))
      .returning();

    if (!wasAlreadyCancelled && Array.isArray(order.items)) {
      for (const item of order.items) {
        await db
          .update(storeProducts)
          .set({ stock: sql`${storeProducts.stock} + ${Math.max(0, Number(item.quantity || 0))}` })
          .where(eq(storeProducts.id, item.productId));
      }
    }

    await createNotification({
      userId: order.buyerId,
      actorId: req.dbUser!.id,
      type: 'store',
      title: `إلغاء الطلب #${order.id} وإرجاع المبلغ`,
      body: `تم إلغاء الطلب لعدم اكتمال التحويل، وإرجاع مبلغ $${cleanRefund} إليك. ${cleanNote}`,
      entityType: 'order',
      entityId: order.id,
    });

    res.json({ order: updated });
  } catch (err) {
    console.error('PATCH /api/store/orders/:id/payment-review failed:', err);
    res.status(500).json({ error: 'Failed to process payment review' });
  }
});

// Seller Order Status Update
router.patch('/orders/:id/status', requireAuth, async (req: AuthRequest, res) => {
  try {
    const orderId = Number(req.params.id);
    const status = String(req.body?.status || '');
    const valid = ['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'];
    if (!valid.includes(status)) return res.status(400).json({ error: 'Invalid order status' });

    const [order] = await db.select().from(storeOrders).where(eq(storeOrders.id, orderId)).limit(1);
    if (!order) return res.status(404).json({ error: 'Order not found' });

    const [store] = await db.select().from(stores).where(eq(stores.id, order.storeId)).limit(1);
    const isSeller = store?.ownerId === req.dbUser!.id;
    const isBuyerCancelling = order.buyerId === req.dbUser!.id && status === 'cancelled' && order.status === 'pending';
    if (!isSeller && !isBuyerCancelling) {
      return res.status(403).json({ error: 'Not authorized to change this order status' });
    }

    const wasAlreadyCancelled = order.status === 'cancelled';

    const [updated] = await db
      .update(storeOrders)
      .set({
        status,
        paymentStatus: status === 'delivered' && order.paymentMethod === 'cod' ? 'paid' : order.paymentStatus,
        updatedAt: new Date(),
      })
      .where(eq(storeOrders.id, orderId))
      .returning();

    if (status === 'cancelled' && !wasAlreadyCancelled && Array.isArray(order.items)) {
      for (const item of order.items) {
        await db
          .update(storeProducts)
          .set({ stock: sql`${storeProducts.stock} + ${Math.max(0, Number(item.quantity || 0))}` })
          .where(eq(storeProducts.id, item.productId));
      }
    }

    await createNotification({
      userId: order.buyerId,
      actorId: req.dbUser!.id,
      type: 'store',
      title: `تحديث حالة الطلب #${order.id}`,
      body: `حالة طلبك الآن: ${status}`,
      entityType: 'order',
      entityId: order.id,
    });

    res.json({ order: updated });
  } catch (err) {
    res.status(500).json({ error: 'Failed to update order status' });
  }
});

export default router;
