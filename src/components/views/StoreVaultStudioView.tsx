import React, { useState, useEffect, useCallback } from 'react';
import {
  ShoppingBag,
  Coins,
  FolderLock,
  Sparkles,
  ShoppingCart,
  Heart,
  Star,
  Plus,
  Trash2,
  Package,
  AlertTriangle,
  CalendarClock,
  FolderPlus,
  BarChart3,
  ExternalLink,
  Landmark,
  Truck,
  CreditCard,
  ShieldCheck,
  XCircle,
  Upload,
} from 'lucide-react';
import { apiFetch } from '../../lib/api';
import { useAuth } from '../../context/AuthContext';
import { LoadingSkeleton } from '../ErrorBoundary';
import { StoreCheckoutModal, CheckoutTarget } from '../StoreCheckoutModal';

export const StoreVaultStudioView: React.FC<{
  initialTab?: 'store' | 'coins' | 'vault' | 'studio';
}> = ({ initialTab = 'store' }) => {
  const { user, lang, notifyToast, refreshUser } = useAuth();
  const [tab, setTab] = useState<'store' | 'coins' | 'vault' | 'studio'>(initialTab);
  const [loading, setLoading] = useState(true);

  // Store state
  const [catalog, setCatalog] = useState<any>({ stripeConfigured: false, stores: [], products: [], cartItems: [] });
  const [ordersData, setOrdersData] = useState<{ buyerOrders: any[]; sellerOrders: any[]; myStores: any[] }>({
    buyerOrders: [],
    sellerOrders: [],
    myStores: [],
  });
  const [storeQuery, setStoreQuery] = useState('');
  const [storeCat, setStoreCat] = useState('all');
  const [storeSort, setStoreSort] = useState('latest');
  const [showCart, setShowCart] = useState(false);
  const [shippingAddress, setShippingAddress] = useState('');
  const [orderNote, setOrderNote] = useState('');
  const [showSellerForm, setShowSellerForm] = useState(false);
  const [newStore, setNewStore] = useState({
    name: '',
    description: '',
    category: 'tech',
    bankName: '',
    accountHolderName: '',
    iban: '',
    accountNumber: '',
    bankNotes: '',
  });
  const [editStoreId, setEditStoreId] = useState<string>('');
  const [editBank, setEditBank] = useState({
    bankName: '',
    accountHolderName: '',
    iban: '',
    accountNumber: '',
    bankNotes: '',
  });
  const [newProduct, setNewProduct] = useState({
    storeId: '',
    title: '',
    description: '',
    category: 'tech',
    priceUsd: '25',
    deliveryFeeUsd: '5',
    allowCod: true,
    allowBankTransfer: true,
    stock: '10',
  });
  const [checkoutTarget, setCheckoutTarget] = useState<CheckoutTarget | null>(null);
  const [refundOrderId, setRefundOrderId] = useState<number | null>(null);
  const [refundAmountInput, setRefundAmountInput] = useState('');
  const [refundNoteInput, setRefundNoteInput] = useState('');
  const [refundReceiptUrl, setRefundReceiptUrl] = useState('');
  const [reviewProductId, setReviewProductId] = useState<number | null>(null);
  const [reviews, setReviews] = useState<any[]>([]);
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewText, setReviewText] = useState('');

  // Coins state
  const [coinsData, setCoinsData] = useState<any>(null);

  // Vault state
  const [vaultData, setVaultData] = useState<{ folders: any[]; items: any[] }>({ folders: [], items: [] });
  const [activeFolderId, setActiveFolderId] = useState<number | 'all'>('all');
  const [newFolderName, setNewFolderName] = useState('');
  const [newVaultItem, setNewVaultItem] = useState({ title: '', itemType: 'note', url: '', summary: '' });

  // Creator Studio state
  const [studioData, setStudioData] = useState<any>(null);
  const [schedContent, setSchedContent] = useState('');
  const [schedAt, setSchedAt] = useState('');
  const [coverTitle, setCoverTitle] = useState('');
  const [coverBg, setCoverBg] = useState('#ea580c');

  useEffect(() => {
    setTab(initialTab);
  }, [initialTab]);

  const loadTab = useCallback(async () => {
    setLoading(true);
    try {
      if (tab === 'store') {
        const [catRes, ordRes] = await Promise.all([
          apiFetch<any>(
            `/api/store/catalog?q=${encodeURIComponent(storeQuery)}&category=${encodeURIComponent(storeCat)}&sort=${storeSort}`
          ),
          apiFetch<any>('/api/store/orders'),
        ]);
        setCatalog(catRes);
        setOrdersData(ordRes);
      } else if (tab === 'coins') {
        const res = await apiFetch('/api/engagement/coins');
        setCoinsData(res);
      } else if (tab === 'vault') {
        const res = await apiFetch<{ folders: any[]; items: any[] }>('/api/ecosystem/vault');
        setVaultData(res);
      } else if (tab === 'studio') {
        const res = await apiFetch('/api/social/creator-analytics');
        setStudioData(res);
      }
    } catch (err: any) {
      notifyToast(err?.message || 'Failed to load data', 'error');
    } finally {
      setLoading(false);
    }
  }, [tab, storeQuery, storeCat, storeSort, notifyToast]);

  useEffect(() => {
    void loadTab();
  }, [loadTab]);

  const openReviews = async (prodId: number) => {
    setReviewProductId(prodId);
    try {
      const res = await apiFetch<{ reviews: any[] }>(`/api/store/products/${prodId}/reviews`);
      setReviews(res.reviews || []);
    } catch {
      setReviews([]);
    }
  };

  const cartTotal = (catalog.cartItems || []).reduce((acc: number, item: any) => {
    const p = item.product;
    if (!p) return acc;
    const price = p.priceUsd * (1 - (p.discountPercent || 0) / 100);
    return acc + price * item.quantity;
  }, 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-4">
        <h2 className="text-xl font-display font-bold">
          {tab === 'store'
            ? 'TIGER STORE'
            : tab === 'coins'
            ? 'TIGER COINS'
            : tab === 'vault'
            ? 'TIGER VAULT'
            : 'CREATOR STUDIO'}
        </h2>

        <div className="flex flex-wrap items-center gap-1 p-1 rounded-xl bg-zinc-100 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800">
          {[
            { key: 'store', ar: 'المتجر', en: 'Store', icon: ShoppingBag },
            { key: 'coins', ar: 'العملات والمكافآت', en: 'Coins', icon: Coins },
            { key: 'vault', ar: 'الخزنة الخاصة', en: 'Vault', icon: FolderLock },
            { key: 'studio', ar: 'استوديو المبدعين', en: 'Studio', icon: Sparkles },
          ].map((item) => {
            const Icon = item.icon;
            return (
              <button
                key={item.key}
                onClick={() => setTab(item.key as any)}
                className={`px-3.5 py-1.5 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 ${
                  tab === item.key ? 'bg-orange-500 text-white' : 'text-zinc-600 dark:text-zinc-400'
                }`}
              >
                <Icon className="w-3.5 h-3.5" />
                <span>{lang === 'ar' ? item.ar : item.en}</span>
              </button>
            );
          })}
        </div>
      </div>

      {/* TIGER STORE */}
      {tab === 'store' && (
        <div className="space-y-5">
          {checkoutTarget && (
            <StoreCheckoutModal
              lang={lang}
              target={checkoutTarget}
              onClose={() => setCheckoutTarget(null)}
              onCompleted={async () => {
                setShowCart(false);
                await loadTab();
              }}
              notifyToast={notifyToast}
            />
          )}

          <div className="rounded-xl border border-orange-500/30 bg-orange-500/5 p-3 text-xs text-zinc-700 dark:text-zinc-300 flex items-start gap-2.5">
            <Landmark className="w-4 h-4 shrink-0 mt-0.5 text-orange-500" />
            <span>
              {lang === 'ar'
                ? 'متجر TIGER يدعم الدفع عند الاستلام والتحويل البنكي المباشر لحساب البائع (مع عرض سعر التوصيل لكل منتج، رفع إيصال التحويل، وإلغاء الطلب مع إرجاع المبلغ إذا لم يُحوّل كاملاً).'
                : 'TIGER Store supports Cash on Delivery and Direct Seller Bank Transfer (per-product delivery fees, receipt verification, and partial-transfer refund cancellation).'}
            </span>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2 flex-1">
              <input
                value={storeQuery}
                onChange={(e) => setStoreQuery(e.target.value)}
                placeholder={lang === 'ar' ? 'ابحث في المنتجات...' : 'Search products...'}
                className="px-3 py-2 rounded-xl text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 min-w-[200px]"
              />
              <select
                value={storeCat}
                onChange={(e) => setStoreCat(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
              >
                <option value="all">{lang === 'ar' ? 'كل التصنيفات' : 'All Categories'}</option>
                <option value="tech">Tech</option>
                <option value="digital">Digital</option>
                <option value="design">Design</option>
                <option value="books">Books</option>
                <option value="merch">Merch</option>
              </select>
              <select
                value={storeSort}
                onChange={(e) => setStoreSort(e.target.value)}
                className="px-3 py-2 rounded-xl text-xs bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
              >
                <option value="latest">{lang === 'ar' ? 'الأحدث' : 'Latest'}</option>
                <option value="price_asc">{lang === 'ar' ? 'السعر: الأقل' : 'Price: Low-High'}</option>
                <option value="price_desc">{lang === 'ar' ? 'السعر: الأعلى' : 'Price: High-Low'}</option>
                <option value="rating">{lang === 'ar' ? 'الأعلى تقييماً' : 'Top Rated'}</option>
              </select>
            </div>

            <div className="flex gap-2">
              <button
                onClick={() => setShowSellerForm((v) => !v)}
                className="px-3.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Plus className="w-3.5 h-3.5 text-orange-500" />
                {lang === 'ar' ? 'إدارة متجري / إضافة منتج' : 'Sell on TIGER'}
              </button>
              <button
                onClick={() => setShowCart((v) => !v)}
                className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-semibold inline-flex items-center gap-1.5 tabular-nums"
              >
                <ShoppingCart className="w-4 h-4" />
                <span>{lang === 'ar' ? 'السلة' : 'Cart'} ({catalog.cartItems?.length || 0})</span>
              </button>
            </div>
          </div>

          {showSellerForm && (
            <div className="space-y-4 rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5">
              <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                {/* Create Store + Bank Account */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold flex items-center gap-1.5">
                    <Landmark className="w-4 h-4 text-orange-500" />
                    {lang === 'ar' ? 'إنشاء متجر وربط الحساب البنكي للتحويل' : 'Create Storefront & Bank Account'}
                  </h3>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={newStore.name}
                      onChange={(e) => setNewStore({ ...newStore, name: e.target.value })}
                      placeholder={lang === 'ar' ? 'اسم المتجر *' : 'Store name *'}
                      className="px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                    />
                    <select
                      value={newStore.category}
                      onChange={(e) => setNewStore({ ...newStore, category: e.target.value })}
                      className="px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                    >
                      <option value="tech">Tech</option>
                      <option value="digital">Digital</option>
                      <option value="design">Design</option>
                      <option value="books">Books</option>
                      <option value="merch">Merch</option>
                    </select>
                  </div>
                  <input
                    value={newStore.description}
                    onChange={(e) => setNewStore({ ...newStore, description: e.target.value })}
                    placeholder={lang === 'ar' ? 'وصف المتجر' : 'Store description'}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={newStore.bankName}
                      onChange={(e) => setNewStore({ ...newStore, bankName: e.target.value })}
                      placeholder={lang === 'ar' ? 'اسم البنك (مثلاً: الراجحي)' : 'Bank Name (e.g. Al Rajhi)'}
                      className="px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                    />
                    <input
                      value={newStore.accountHolderName}
                      onChange={(e) => setNewStore({ ...newStore, accountHolderName: e.target.value })}
                      placeholder={lang === 'ar' ? 'اسم صاحب الحساب' : 'Account Holder Name'}
                      className="px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={newStore.iban}
                      onChange={(e) => setNewStore({ ...newStore, iban: e.target.value })}
                      placeholder={lang === 'ar' ? 'رقم الآيبان IBAN' : 'IBAN Number'}
                      className="px-3 py-2 rounded-xl text-xs font-mono bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                    />
                    <input
                      value={newStore.accountNumber}
                      onChange={(e) => setNewStore({ ...newStore, accountNumber: e.target.value })}
                      placeholder={lang === 'ar' ? 'رقم الحساب البنكي' : 'Bank Account Number'}
                      className="px-3 py-2 rounded-xl text-xs font-mono bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                    />
                  </div>
                  <input
                    value={newStore.bankNotes}
                    onChange={(e) => setNewStore({ ...newStore, bankNotes: e.target.value })}
                    placeholder={lang === 'ar' ? 'ملاحظات التحويل (اختياري)' : 'Transfer notes (optional)'}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                  />
                  <button
                    onClick={async () => {
                      if (!newStore.name.trim()) return;
                      await apiFetch('/api/store/stores', { method: 'POST', body: JSON.stringify(newStore) });
                      setNewStore({
                        name: '',
                        description: '',
                        category: 'tech',
                        bankName: '',
                        accountHolderName: '',
                        iban: '',
                        accountNumber: '',
                        bankNotes: '',
                      });
                      await loadTab();
                      notifyToast(lang === 'ar' ? 'تم إنشاء المتجر وحفظ بيانات البنك' : 'Store & bank details saved', 'success');
                    }}
                    className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-semibold"
                  >
                    {lang === 'ar' ? 'إنشاء المتجر' : 'Create Store'}
                  </button>
                </div>

                {/* Add Product + Per-Product Delivery Fee */}
                <div className="space-y-3">
                  <h3 className="text-sm font-bold flex items-center gap-1.5">
                    <Package className="w-4 h-4 text-orange-500" />
                    {lang === 'ar' ? 'إضافة بضاعة وسعر التوصيل' : 'Add Product & Delivery Fee'}
                  </h3>
                  <select
                    value={newProduct.storeId}
                    onChange={(e) => setNewProduct({ ...newProduct, storeId: e.target.value })}
                    className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                  >
                    <option value="">{lang === 'ar' ? 'اختر متجرك...' : 'Select your store...'}</option>
                    {ordersData.myStores.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.name}
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <input
                      value={newProduct.title}
                      onChange={(e) => setNewProduct({ ...newProduct, title: e.target.value })}
                      placeholder={lang === 'ar' ? 'اسم المنتج *' : 'Product title *'}
                      className="px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                    />
                    <input
                      value={newProduct.description}
                      onChange={(e) => setNewProduct({ ...newProduct, description: e.target.value })}
                      placeholder={lang === 'ar' ? 'وصف مختصر' : 'Short description'}
                      className="px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                    />
                  </div>
                  <div className="grid grid-cols-3 gap-2">
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-0.5">{lang === 'ar' ? 'السعر ($)' : 'Price ($)'}</label>
                      <input
                        type="number"
                        step="0.01"
                        value={newProduct.priceUsd}
                        onChange={(e) => setNewProduct({ ...newProduct, priceUsd: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-0.5">{lang === 'ar' ? 'سعر التوصيل ($)' : 'Delivery ($)'}</label>
                      <input
                        type="number"
                        step="0.01"
                        min="0"
                        value={newProduct.deliveryFeeUsd}
                        onChange={(e) => setNewProduct({ ...newProduct, deliveryFeeUsd: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                      />
                    </div>
                    <div>
                      <label className="text-[10px] text-zinc-500 block mb-0.5">{lang === 'ar' ? 'المخزون' : 'Stock'}</label>
                      <input
                        type="number"
                        value={newProduct.stock}
                        onChange={(e) => setNewProduct({ ...newProduct, stock: e.target.value })}
                        className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                      />
                    </div>
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs">
                    <select
                      value={newProduct.category}
                      onChange={(e) => setNewProduct({ ...newProduct, category: e.target.value })}
                      className="px-3 py-1.5 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                    >
                      <option value="tech">Tech</option>
                      <option value="digital">Digital</option>
                      <option value="design">Design</option>
                      <option value="books">Books</option>
                      <option value="merch">Merch</option>
                    </select>
                    <label className="inline-flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={newProduct.allowBankTransfer}
                        onChange={(e) => setNewProduct({ ...newProduct, allowBankTransfer: e.target.checked })}
                      />
                      <span>{lang === 'ar' ? 'دفع أونلاين (تحويل بنكي)' : 'Bank Transfer'}</span>
                    </label>
                    <label className="inline-flex items-center gap-1.5">
                      <input
                        type="checkbox"
                        checked={newProduct.allowCod}
                        onChange={(e) => setNewProduct({ ...newProduct, allowCod: e.target.checked })}
                      />
                      <span>{lang === 'ar' ? 'عند الاستلام' : 'Cash on Delivery'}</span>
                    </label>
                  </div>
                  <button
                    onClick={async () => {
                      if (!newProduct.storeId || !newProduct.title.trim()) return;
                      await apiFetch('/api/store/products', {
                        method: 'POST',
                        body: JSON.stringify({
                          ...newProduct,
                          storeId: Number(newProduct.storeId),
                          priceUsd: Number(newProduct.priceUsd),
                          deliveryFeeUsd: Number(newProduct.deliveryFeeUsd || 0),
                          stock: Number(newProduct.stock),
                        }),
                      });
                      setNewProduct({
                        storeId: newProduct.storeId,
                        title: '',
                        description: '',
                        category: 'tech',
                        priceUsd: '25',
                        deliveryFeeUsd: '5',
                        allowCod: true,
                        allowBankTransfer: true,
                        stock: '10',
                      });
                      await loadTab();
                      notifyToast(lang === 'ar' ? 'تمت إضافة المنتج مع سعر التوصيل' : 'Product published!', 'success');
                    }}
                    className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-semibold"
                  >
                    {lang === 'ar' ? 'نشر المنتج' : 'Publish Product'}
                  </button>
                </div>
              </div>

              {/* Edit Bank Details for Existing Store */}
              {ordersData.myStores.length > 0 && (
                <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <h4 className="text-xs font-bold text-orange-500">
                      {lang === 'ar' ? 'تحديث بيانات الحساب البنكي لمتجر حالي' : 'Update Existing Store Bank Details'}
                    </h4>
                    <select
                      value={editStoreId}
                      onChange={(e) => {
                        const sid = e.target.value;
                        setEditStoreId(sid);
                        const found = ordersData.myStores.find((s) => String(s.id) === sid);
                        if (found) {
                          setEditBank({
                            bankName: found.bankName || '',
                            accountHolderName: found.accountHolderName || '',
                            iban: found.iban || '',
                            accountNumber: found.accountNumber || '',
                            bankNotes: found.bankNotes || '',
                          });
                        }
                      }}
                      className="px-3 py-1.5 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                    >
                      <option value="">{lang === 'ar' ? 'اختر متجراً لتعديل حسابه البنكي...' : 'Pick a store to edit bank info...'}</option>
                      {ordersData.myStores.map((s) => (
                        <option key={s.id} value={s.id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                  {editStoreId && (
                    <div className="grid grid-cols-1 sm:grid-cols-5 gap-2">
                      <input
                        value={editBank.bankName}
                        onChange={(e) => setEditBank({ ...editBank, bankName: e.target.value })}
                        placeholder={lang === 'ar' ? 'اسم البنك' : 'Bank Name'}
                        className="px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                      />
                      <input
                        value={editBank.accountHolderName}
                        onChange={(e) => setEditBank({ ...editBank, accountHolderName: e.target.value })}
                        placeholder={lang === 'ar' ? 'اسم المستفيد' : 'Account Holder'}
                        className="px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                      />
                      <input
                        value={editBank.iban}
                        onChange={(e) => setEditBank({ ...editBank, iban: e.target.value })}
                        placeholder="IBAN"
                        className="px-3 py-2 rounded-xl text-xs font-mono bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                      />
                      <input
                        value={editBank.accountNumber}
                        onChange={(e) => setEditBank({ ...editBank, accountNumber: e.target.value })}
                        placeholder={lang === 'ar' ? 'رقم الحساب' : 'Account #'}
                        className="px-3 py-2 rounded-xl text-xs font-mono bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                      />
                      <button
                        onClick={async () => {
                          await apiFetch(`/api/store/stores/${editStoreId}`, {
                            method: 'PATCH',
                            body: JSON.stringify(editBank),
                          });
                          await loadTab();
                          notifyToast(lang === 'ar' ? 'تم تحديث الحساب البنكي للمتجر' : 'Store bank details updated', 'success');
                        }}
                        className="px-4 py-2 rounded-xl bg-emerald-500 text-white text-xs font-semibold"
                      >
                        {lang === 'ar' ? 'حفظ الحساب' : 'Save Bank'}
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {showCart && (
            <div className="rounded-2xl border border-orange-500/40 bg-white dark:bg-zinc-900 p-5 space-y-4">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">{lang === 'ar' ? 'سلة التسوق' : 'Shopping Cart'}</h3>
                <span className="text-sm font-mono font-bold text-orange-500 tabular-nums">${cartTotal.toFixed(2)}</span>
              </div>
              {catalog.cartItems?.length === 0 ? (
                <p className="text-xs text-zinc-500">{lang === 'ar' ? 'السلة فارغة حالياً' : 'Cart is empty'}</p>
              ) : (
                <>
                  <div className="space-y-2">
                    {catalog.cartItems.map((c: any) => (
                      <div key={c.id} className="flex items-center justify-between p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 text-xs">
                        <div>
                          <span className="font-semibold">{c.product?.title}</span> × {c.quantity}
                          <span className="text-zinc-500 ms-2">
                            ({lang === 'ar' ? 'توصيل' : 'Deliv'}: ${(c.product?.deliveryFeeUsd || 0).toFixed(2)})
                          </span>
                        </div>
                        <div className="flex items-center gap-3">
                          <span className="font-mono tabular-nums">
                            ${(((c.product?.priceUsd || 0) * c.quantity) + (c.product?.deliveryFeeUsd || 0)).toFixed(2)}
                          </span>
                          <button
                            onClick={() =>
                              void apiFetch(`/api/store/cart/${c.productId}`, { method: 'DELETE' }).then(() => loadTab())
                            }
                            className="text-red-500"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </div>
                    ))}
                  </div>
                  {(() => {
                    const uniqueStoreIds = Array.from(new Set(catalog.cartItems.map((c: any) => c.product?.storeId).filter(Boolean)));
                    if (uniqueStoreIds.length === 1) {
                      const firstStore = catalog.cartItems[0]?.product?.store;
                      return (
                        <button
                          onClick={() =>
                            setCheckoutTarget({
                              mode: 'cart',
                              cartItems: catalog.cartItems,
                              store: firstStore,
                            })
                          }
                          className="px-5 py-2.5 rounded-xl bg-orange-500 text-white text-xs font-bold inline-flex items-center gap-2"
                        >
                          <CreditCard className="w-4 h-4" />
                          <span>{lang === 'ar' ? 'شراء واختيار طريقة الدفع (أونلاين / عند الاستلام)' : 'Buy & Choose Payment (Online / COD)'}</span>
                        </button>
                      );
                    }
                    return (
                      <>
                        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                          <input
                            value={shippingAddress}
                            onChange={(e) => setShippingAddress(e.target.value)}
                            placeholder={lang === 'ar' ? 'عنوان الشحن أو وسيلة التواصل' : 'Shipping address or delivery contact'}
                            className="px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                          />
                          <input
                            value={orderNote}
                            onChange={(e) => setOrderNote(e.target.value)}
                            placeholder={lang === 'ar' ? 'ملاحظات الطلب (اختياري)' : 'Order notes (optional)'}
                            className="px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                          />
                        </div>
                        <button
                          onClick={async () => {
                            if (!shippingAddress.trim()) {
                              return notifyToast(lang === 'ar' ? 'أدخل عنوان التوصيل' : 'Enter delivery contact/address', 'error');
                            }
                            await apiFetch('/api/store/orders/checkout', {
                              method: 'POST',
                              body: JSON.stringify({ shippingAddress, note: orderNote, paymentMethod: 'cod' }),
                            });
                            setShippingAddress('');
                            setOrderNote('');
                            setShowCart(false);
                            await loadTab();
                            notifyToast(lang === 'ar' ? 'تم تسجيل طلباتك (الدفع عند الاستلام)' : 'COD orders placed!', 'success');
                          }}
                          className="px-5 py-2.5 rounded-xl bg-orange-500 text-white text-xs font-semibold"
                        >
                          {lang === 'ar' ? 'تأكيد السلة (عند الاستلام لجميع المتاجر)' : 'Place Multi-Store COD Order'}
                        </button>
                      </>
                    );
                  })()}
                </>
              )}
            </div>
          )}

          {loading ? (
            <LoadingSkeleton rows={3} />
          ) : catalog.products?.length === 0 ? (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-10 text-center text-sm text-zinc-500">
              {lang === 'ar' ? 'لا توجد منتجات مطابقة بعد. أنشئ متجرك وأضف أول منتج!' : 'No products yet. Open a store and add the first item!'}
            </div>
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {catalog.products.map((p: any) => (
                <div key={p.id} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 flex flex-col justify-between gap-3">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs text-zinc-500">
                      <span>{p.store?.name || p.category}</span>
                      <span className="inline-flex items-center gap-1 tabular-nums">
                        <Star className="w-3.5 h-3.5 text-amber-400" /> {p.ratingAvg || 0} ({p.reviewsCount})
                      </span>
                    </div>
                    <h3 className="text-base font-bold">{p.title}</h3>
                    {p.description && <p className="text-xs text-zinc-500 line-clamp-2">{p.description}</p>}
                  </div>
                  <div className="space-y-3 pt-2 border-t border-zinc-200 dark:border-zinc-800">
                    <div className="flex items-center justify-between tabular-nums">
                      <div>
                        <span className="text-lg font-mono font-bold text-orange-500">${p.priceUsd}</span>
                        <div className="text-[11px] text-zinc-500 inline-flex items-center gap-1 ms-2">
                          <Truck className="w-3 h-3 text-emerald-500" />
                          {Number(p.deliveryFeeUsd || 0) > 0
                            ? lang === 'ar'
                              ? `توصيل $${Number(p.deliveryFeeUsd).toFixed(2)}`
                              : `+$${Number(p.deliveryFeeUsd).toFixed(2)} delivery`
                            : lang === 'ar'
                            ? 'توصيل مجاني'
                            : 'Free delivery'}
                        </div>
                      </div>
                      <span className="text-xs text-zinc-500">
                        {lang === 'ar' ? `المتاح: ${p.stock}` : `Stock: ${p.stock}`}
                      </span>
                    </div>
                    <div className="flex flex-wrap gap-1.5 text-[10px]">
                      {p.allowBankTransfer !== false && (
                        <span className="px-2 py-0.5 rounded-md bg-orange-500/10 text-orange-500 font-semibold">
                          {lang === 'ar' ? 'دفع أونلاين' : 'Online Bank'}
                        </span>
                      )}
                      {p.allowCod !== false && (
                        <span className="px-2 py-0.5 rounded-md bg-emerald-500/10 text-emerald-500 font-semibold">
                          {lang === 'ar' ? 'عند الاستلام' : 'COD'}
                        </span>
                      )}
                    </div>
                    <div className="flex gap-2">
                      <button
                        disabled={p.stock < 1}
                        onClick={() =>
                          setCheckoutTarget({
                            mode: 'direct',
                            product: p,
                            store: p.store,
                          })
                        }
                        className="flex-1 py-2 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-40 text-white text-xs font-bold inline-flex items-center justify-center gap-1.5"
                      >
                        <CreditCard className="w-3.5 h-3.5" />
                        <span>{lang === 'ar' ? 'شراء الآن' : 'Buy Now'}</span>
                      </button>
                      <button
                        disabled={p.stock < 1}
                        onClick={() =>
                          void apiFetch('/api/store/cart', {
                            method: 'POST',
                            body: JSON.stringify({ productId: p.id, quantity: 1 }),
                          })
                            .then(() => {
                              notifyToast(lang === 'ar' ? 'أُضيف إلى السلة' : 'Added to cart', 'success');
                              return loadTab();
                            })
                            .catch((err: any) => notifyToast(err?.message || 'Failed', 'error'))
                        }
                        className="px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 hover:border-orange-500 disabled:opacity-40 text-xs font-semibold"
                        title={lang === 'ar' ? 'إضافة للسلة' : 'Add to Cart'}
                      >
                        <ShoppingCart className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() =>
                          void apiFetch(`/api/store/products/${p.id}/favorite`, { method: 'POST' }).then(() => loadTab())
                        }
                        className={`p-2 rounded-xl border border-zinc-200 dark:border-zinc-800 ${
                          p.isFavorite ? 'text-rose-500 border-rose-500/40' : 'text-zinc-500'
                        }`}
                      >
                        <Heart className="w-4 h-4" />
                      </button>
                      <button
                        onClick={() => void openReviews(p.id)}
                        className="px-2.5 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs"
                      >
                        {lang === 'ar' ? 'تقييم' : 'Reviews'}
                      </button>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          )}

          {/* Reviews Box */}
          {reviewProductId && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">{lang === 'ar' ? 'تقييمات المنتج' : 'Product Reviews'}</h3>
                <button onClick={() => setReviewProductId(null)} className="text-xs text-zinc-500">
                  {lang === 'ar' ? 'إغلاق' : 'Close'}
                </button>
              </div>
              <div className="flex flex-wrap gap-2">
                <select
                  value={reviewRating}
                  onChange={(e) => setReviewRating(Number(e.target.value))}
                  className="px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} ★
                    </option>
                  ))}
                </select>
                <input
                  value={reviewText}
                  onChange={(e) => setReviewText(e.target.value)}
                  placeholder={lang === 'ar' ? 'اكتب تقييمك...' : 'Write your review...'}
                  className="flex-1 px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                />
                <button
                  onClick={async () => {
                    await apiFetch(`/api/store/products/${reviewProductId}/reviews`, {
                      method: 'POST',
                      body: JSON.stringify({ rating: reviewRating, comment: reviewText }),
                    });
                    setReviewText('');
                    await Promise.all([openReviews(reviewProductId), loadTab()]);
                  }}
                  className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-semibold"
                >
                  {lang === 'ar' ? 'إرسال' : 'Post'}
                </button>
              </div>
              <div className="space-y-2">
                {reviews.map((r) => (
                  <div key={r.id} className="p-2.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 text-xs">
                    <span className="font-bold">{r.author?.displayName}</span> · <span className="text-amber-400">{r.rating} ★</span>
                    {r.comment && <p className="text-zinc-600 dark:text-zinc-400 mt-0.5">{r.comment}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Buyer & Seller Orders */}
          {(ordersData.buyerOrders.length > 0 || ordersData.sellerOrders.length > 0) && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Package className="w-4 h-4 text-orange-500" /> {lang === 'ar' ? 'مشترياتي' : 'My Orders'}
                </h3>
                {ordersData.buyerOrders.map((o) => (
                  <div key={o.id} className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs space-y-2 tabular-nums">
                    <div className="flex flex-wrap justify-between items-center gap-2">
                      <div className="font-bold">
                        #{o.id} · {o.store?.name || 'Store'} · <span className="text-orange-500">${o.totalUsd}</span>
                      </div>
                      <span
                        className={`px-2 py-0.5 rounded-md text-[10px] font-bold ${
                          o.paymentStatus === 'paid'
                            ? 'bg-emerald-500/15 text-emerald-500'
                            : o.paymentStatus === 'refunded'
                            ? 'bg-red-500/15 text-red-500'
                            : o.paymentStatus === 'refund_required'
                            ? 'bg-amber-500/15 text-amber-500'
                            : 'bg-zinc-200 dark:bg-zinc-800 text-zinc-600 dark:text-zinc-300'
                        }`}
                      >
                        {o.paymentMethod === 'bank_transfer'
                          ? o.paymentStatus === 'paid'
                            ? lang === 'ar' ? 'تحويل بنكي مؤكد' : 'Transfer Verified'
                            : o.paymentStatus === 'refunded'
                            ? lang === 'ar' ? 'ملغي - تم إرجاع المبلغ' : 'Cancelled & Refunded'
                            : o.paymentStatus === 'refund_required'
                            ? lang === 'ar' ? 'المبلغ المحوّل ناقص' : 'Partial Transfer'
                            : lang === 'ar' ? 'بانتظار مراجعة الإيصال' : 'Receipt Under Review'
                          : lang === 'ar' ? 'الدفع عند الاستلام' : 'Cash on Delivery'}
                      </span>
                    </div>
                    <div className="text-zinc-500 flex flex-wrap gap-3">
                      <span>{lang === 'ar' ? `الحالة: ${o.status}` : `Status: ${o.status}`}</span>
                      <span>{lang === 'ar' ? `التوصيل: $${Number(o.deliveryFeeUsd || 0).toFixed(2)}` : `Delivery: $${Number(o.deliveryFeeUsd || 0).toFixed(2)}`}</span>
                      {o.transferReference && <span className="font-mono">{o.transferReference}</span>}
                    </div>
                    {o.transferReceiptUrl && (
                      <a
                        href={o.transferReceiptUrl}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 text-orange-500 hover:underline font-semibold"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        {lang === 'ar' ? 'عرض إيصال التحويل المرفوع' : 'View Uploaded Receipt'}
                      </a>
                    )}
                    {o.paymentStatus === 'refunded' && (
                      <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-300 space-y-1">
                        <div className="font-bold">
                          {lang === 'ar'
                            ? `تم إلغاء الطلب وإرجاع مبلغ $${Number(o.refundAmountUsd || 0).toFixed(2)} إليك`
                            : `Order cancelled — $${Number(o.refundAmountUsd || 0).toFixed(2)} refunded`}
                        </div>
                        {o.refundNote && <div>{o.refundNote}</div>}
                        {o.refundReceiptUrl && (
                          <a href={o.refundReceiptUrl} target="_blank" rel="noreferrer" className="underline inline-flex items-center gap-1">
                            <ExternalLink className="w-3 h-3" /> {lang === 'ar' ? 'إيصال الإرجاع من البائع' : 'Seller Refund Receipt'}
                          </a>
                        )}
                      </div>
                    )}
                  </div>
                ))}
              </section>

              <section className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
                <h3 className="text-sm font-bold flex items-center gap-2">
                  <Package className="w-4 h-4 text-emerald-500" /> {lang === 'ar' ? 'طلبات متجري (مراجعة التحويلات والطلبات)' : 'Seller Orders & Bank Verification'}
                </h3>
                {ordersData.sellerOrders.map((o) => {
                  const isPartial =
                    o.paymentMethod === 'bank_transfer' &&
                    (o.paymentStatus === 'refund_required' || Number(o.transferredAmountUsd || 0) + 0.01 < Number(o.totalUsd || 0));
                  const canReviewPayment =
                    o.paymentMethod === 'bank_transfer' &&
                    o.paymentStatus !== 'paid' &&
                    o.paymentStatus !== 'refunded' &&
                    o.status !== 'cancelled';

                  return (
                    <div key={o.id} className="p-3.5 rounded-xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 text-xs space-y-2.5 tabular-nums">
                      <div className="flex flex-wrap justify-between items-center gap-2">
                        <div>
                          <div className="font-bold">
                            #{o.id} · {o.buyer?.displayName || 'Buyer'} · <span className="text-orange-500">${o.totalUsd}</span>
                          </div>
                          <div className="text-zinc-500">{o.shippingAddress}</div>
                        </div>
                        <select
                          value={o.status}
                          onChange={(e) =>
                            void apiFetch(`/api/store/orders/${o.id}/status`, {
                              method: 'PATCH',
                              body: JSON.stringify({ status: e.target.value }),
                            }).then(() => loadTab())
                          }
                          className="px-2 py-1 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
                        >
                          {['pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'].map((st) => (
                            <option key={st} value={st}>
                              {st}
                            </option>
                          ))}
                        </select>
                      </div>

                      {o.paymentMethod === 'bank_transfer' && (
                        <div className="p-2.5 rounded-lg bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 space-y-2">
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <span>
                              {lang === 'ar' ? 'المبلغ المحوّل: ' : 'Transferred: '}
                              <strong className={isPartial ? 'text-red-500' : 'text-emerald-500'}>
                                ${Number(o.transferredAmountUsd || 0).toFixed(2)}
                              </strong>{' '}
                              / ${Number(o.totalUsd || 0).toFixed(2)}
                              {o.selectedBankApp && <span className="text-zinc-500 ms-1.5">({o.selectedBankApp})</span>}
                            </span>
                            {o.transferReceiptUrl && (
                              <a
                                href={o.transferReceiptUrl}
                                target="_blank"
                                rel="noreferrer"
                                className="text-orange-500 hover:underline font-semibold inline-flex items-center gap-1"
                              >
                                <ExternalLink className="w-3.5 h-3.5" />
                                {lang === 'ar' ? 'فتح الإيصال' : 'Open Receipt'}
                              </a>
                            )}
                          </div>

                          {isPartial && o.paymentStatus !== 'refunded' && (
                            <div className="text-[11px] text-amber-600 dark:text-amber-400 font-semibold flex items-center gap-1.5">
                              <AlertTriangle className="w-3.5 h-3.5 shrink-0" />
                              <span>
                                {lang === 'ar'
                                  ? 'المشتري لم يحوّل المبلغ كاملاً — يمكنك إلغاء الطلبية وإرجاع المبلغ المحوّل مسبقاً.'
                                  : 'Buyer did not transfer the full amount — cancel & refund their transferred amount.'}
                              </span>
                            </div>
                          )}

                          {canReviewPayment && (
                            <div className="flex flex-wrap gap-2 pt-1">
                              <button
                                onClick={() =>
                                  void apiFetch(`/api/store/orders/${o.id}/payment-review`, {
                                    method: 'PATCH',
                                    body: JSON.stringify({ action: 'confirm_payment' }),
                                  })
                                    .then(() => {
                                      notifyToast(lang === 'ar' ? 'تم تأكيد استلام المبلغ' : 'Payment confirmed', 'success');
                                      return loadTab();
                                    })
                                    .catch((err: any) => notifyToast(err?.message || 'Error', 'error'))
                                }
                                className="px-3 py-1.5 rounded-lg bg-emerald-500 text-white font-semibold inline-flex items-center gap-1"
                              >
                                <ShieldCheck className="w-3.5 h-3.5" />
                                <span>{lang === 'ar' ? 'تأكيد استلام المبلغ الكامل' : 'Confirm Full Payment'}</span>
                              </button>
                              <button
                                onClick={() => {
                                  setRefundOrderId(refundOrderId === o.id ? null : o.id);
                                  setRefundAmountInput(String(o.transferredAmountUsd || 0));
                                  setRefundNoteInput(
                                    lang === 'ar'
                                      ? 'المبلغ المحوّل غير مكتمل؛ تم إلغاء الطلبية وإرجاع المبلغ المحوّل مسبقاً.'
                                      : 'Incomplete transfer; order cancelled and partial payment refunded.'
                                  );
                                  setRefundReceiptUrl('');
                                }}
                                className="px-3 py-1.5 rounded-lg bg-red-500/15 border border-red-500/40 text-red-500 font-semibold inline-flex items-center gap-1"
                              >
                                <XCircle className="w-3.5 h-3.5" />
                                <span>{lang === 'ar' ? 'إلغاء وإرجاع المبلغ المحوّل' : 'Cancel & Refund Partial'}</span>
                              </button>
                            </div>
                          )}

                          {refundOrderId === o.id && (
                            <div className="p-2.5 rounded-lg bg-red-500/5 border border-red-500/30 space-y-2 mt-2">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                                <input
                                  type="number"
                                  step="0.01"
                                  value={refundAmountInput}
                                  onChange={(e) => setRefundAmountInput(e.target.value)}
                                  placeholder={lang === 'ar' ? 'المبلغ المُرجَع ($)' : 'Refund Amount ($)'}
                                  className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 font-mono"
                                />
                                <label className="px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-950 border border-dashed border-red-400 cursor-pointer flex items-center justify-center gap-1.5">
                                  <Upload className="w-3.5 h-3.5 text-red-500" />
                                  <span className="truncate">
                                    {refundReceiptUrl
                                      ? lang === 'ar' ? 'تم إرفاق إيصال الإرجاع ✓' : 'Refund receipt attached ✓'
                                      : lang === 'ar' ? 'رفع إيصال الإرجاع (اختياري)' : 'Upload Refund Receipt (opt.)'}
                                  </span>
                                  <input
                                    type="file"
                                    accept="image/*,application/pdf"
                                    onChange={async (e) => {
                                      const f = e.target.files?.[0];
                                      if (!f) return;
                                      const fd = new FormData();
                                      fd.append('file', f);
                                      const res = await apiFetch<{ url: string }>('/api/store/receipts/upload', {
                                        method: 'POST',
                                        body: fd,
                                      });
                                      setRefundReceiptUrl(res.url);
                                    }}
                                    className="hidden"
                                  />
                                </label>
                              </div>
                              <input
                                value={refundNoteInput}
                                onChange={(e) => setRefundNoteInput(e.target.value)}
                                placeholder={lang === 'ar' ? 'سبب الإلغاء وملاحظة الإرجاع' : 'Refund note'}
                                className="w-full px-2.5 py-1.5 rounded-lg bg-white dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                              />
                              <button
                                onClick={async () => {
                                  await apiFetch(`/api/store/orders/${o.id}/payment-review`, {
                                    method: 'PATCH',
                                    body: JSON.stringify({
                                      action: 'cancel_and_refund',
                                      refundAmountUsd: Number(refundAmountInput || 0),
                                      refundReceiptUrl,
                                      refundNote: refundNoteInput,
                                    }),
                                  });
                                  setRefundOrderId(null);
                                  await loadTab();
                                  notifyToast(
                                    lang === 'ar' ? 'تم إلغاء الطلبية وإرجاع المبلغ للمشتري' : 'Order cancelled & refund recorded!',
                                    'success'
                                  );
                                }}
                                className="px-3.5 py-1.5 rounded-lg bg-red-500 text-white font-bold"
                              >
                                {lang === 'ar' ? 'تأكيد الإلغاء وإرسال إشعار الإرجاع' : 'Confirm Cancel & Refund'}
                              </button>
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  );
                })}
              </section>
            </div>
          )}
        </div>
      )}

      {/* TIGER COINS WALLET */}
      {tab === 'coins' && coinsData && (
        <div className="space-y-5">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-6 flex flex-wrap items-center justify-between gap-4">
            <div>
              <div className="text-xs text-zinc-500">{lang === 'ar' ? 'رصيدك الافتراضي من Tiger Coins' : 'Your Virtual Tiger Coins Balance'}</div>
              <div className="text-3xl font-display font-extrabold text-amber-500 tabular-nums mt-1">
                {coinsData.balance} Coins
              </div>
              <p className="text-xs text-zinc-500 mt-1">
                {lang === 'ar'
                  ? 'عملات افتراضية تجميلية داخل المنصة فقط (بدون قيمة مالية أو سحب نقدي).'
                  : 'Virtual cosmetic ecosystem tokens only — zero monetary value or cash-out.'}
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
            {(coinsData.catalog || []).map((item: any) => (
              <div key={item.id} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 flex flex-col justify-between gap-3">
                <div>
                  <div className="text-xs text-orange-500 font-semibold uppercase">{item.itemType}</div>
                  <h3 className="text-base font-bold mt-1">{item.title}</h3>
                  <p className="text-xs text-zinc-500 mt-1">{item.description}</p>
                </div>
                <div className="flex items-center justify-between pt-2 border-t border-zinc-200 dark:border-zinc-800 tabular-nums">
                  <span className="font-mono font-bold text-amber-500">{item.costCoins} Coins</span>
                  {item.isUnlocked ? (
                    <span className="text-xs font-semibold text-emerald-500">{lang === 'ar' ? 'مفتوح ✓' : 'Unlocked ✓'}</span>
                  ) : (
                    <button
                      disabled={coinsData.balance < item.costCoins}
                      onClick={() =>
                        void apiFetch('/api/engagement/coins/redeem', {
                          method: 'POST',
                          body: JSON.stringify({ rewardId: item.id }),
                        })
                          .then(() => Promise.all([loadTab(), refreshUser()]))
                          .then(() => notifyToast(lang === 'ar' ? 'تم استبدال المكافأة التجميلية!' : 'Cosmetic item unlocked!', 'success'))
                          .catch((err: any) => notifyToast(err?.message || 'Redeem failed', 'error'))
                      }
                      className="px-3.5 py-1.5 rounded-xl bg-orange-500 disabled:opacity-40 text-white text-xs font-semibold"
                    >
                      {lang === 'ar' ? 'استبدال' : 'Redeem'}
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>

          {coinsData.transactions?.length > 0 && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-2">
              <h3 className="text-sm font-bold">{lang === 'ar' ? 'سجل العملات' : 'Coin Activity Log'}</h3>
              {coinsData.transactions.map((tx: any) => (
                <div key={tx.id} className="flex justify-between text-xs py-1.5 border-b border-zinc-100 dark:border-zinc-800 tabular-nums">
                  <span>{tx.reason}</span>
                  <span className={`font-mono font-bold ${tx.amount >= 0 ? 'text-emerald-500' : 'text-amber-500'}`}>
                    {tx.amount >= 0 ? `+${tx.amount}` : tx.amount}
                  </span>
                </div>
              ))}
            </div>
          )}
        </div>
      )}

      {/* TIGER VAULT */}
      {tab === 'vault' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-4">
            <h3 className="text-sm font-bold flex items-center gap-2">
              <FolderPlus className="w-4 h-4 text-orange-500" /> {lang === 'ar' ? 'المجلدات الخاصة' : 'Private Folders'}
            </h3>
            <div className="flex gap-2">
              <input
                value={newFolderName}
                onChange={(e) => setNewFolderName(e.target.value)}
                placeholder={lang === 'ar' ? 'اسم المجلد...' : 'Folder name...'}
                className="flex-1 px-3 py-1.5 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
              />
              <button
                onClick={async () => {
                  if (!newFolderName.trim()) return;
                  await apiFetch('/api/ecosystem/vault/folders', {
                    method: 'POST',
                    body: JSON.stringify({ name: newFolderName }),
                  });
                  setNewFolderName('');
                  await loadTab();
                }}
                className="px-3 py-1.5 rounded-xl bg-orange-500 text-white text-xs font-semibold"
              >
                +
              </button>
            </div>
            <div className="space-y-1">
              <button
                onClick={() => setActiveFolderId('all')}
                className={`w-full text-start px-3 py-2 rounded-xl text-xs font-semibold ${
                  activeFolderId === 'all' ? 'bg-orange-500 text-white' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                }`}
              >
                {lang === 'ar' ? 'كل المحفوظات' : 'All Saved Items'} ({vaultData.items.length})
              </button>
              {vaultData.folders.map((f) => (
                <div key={f.id} className="flex items-center justify-between gap-1">
                  <button
                    onClick={() => setActiveFolderId(f.id)}
                    className={`flex-1 text-start px-3 py-2 rounded-xl text-xs font-semibold truncate ${
                      activeFolderId === f.id ? 'bg-orange-500 text-white' : 'hover:bg-zinc-100 dark:hover:bg-zinc-800'
                    }`}
                  >
                    {f.name}
                  </button>
                  <button
                    onClick={() =>
                      void apiFetch(`/api/ecosystem/vault/folders/${f.id}`, { method: 'DELETE' }).then(() => loadTab())
                    }
                    className="p-1.5 text-zinc-400 hover:text-red-500"
                  >
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="lg:col-span-2 space-y-4">
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
              <h3 className="text-sm font-bold">{lang === 'ar' ? 'إضافة عنصر للخزنة' : 'Save New Item to Vault'}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <input
                  value={newVaultItem.title}
                  onChange={(e) => setNewVaultItem({ ...newVaultItem, title: e.target.value })}
                  placeholder={lang === 'ar' ? 'العنوان' : 'Title'}
                  className="px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                />
                <input
                  value={newVaultItem.url}
                  onChange={(e) => setNewVaultItem({ ...newVaultItem, url: e.target.value })}
                  placeholder="https://... (optional)"
                  className="px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                />
              </div>
              <input
                value={newVaultItem.summary}
                onChange={(e) => setNewVaultItem({ ...newVaultItem, summary: e.target.value })}
                placeholder={lang === 'ar' ? 'ملاحظة أو ملخص...' : 'Note or summary...'}
                className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
              />
              <button
                onClick={async () => {
                  if (!newVaultItem.title.trim()) return;
                  await apiFetch('/api/ecosystem/vault/items', {
                    method: 'POST',
                    body: JSON.stringify({
                      ...newVaultItem,
                      folderId: activeFolderId === 'all' ? null : activeFolderId,
                    }),
                  });
                  setNewVaultItem({ title: '', itemType: 'note', url: '', summary: '' });
                  await loadTab();
                }}
                className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-semibold"
              >
                {lang === 'ar' ? 'حفظ في الخزنة' : 'Save Item'}
              </button>
            </div>

            <div className="space-y-3">
              {vaultData.items
                .filter((it) => activeFolderId === 'all' || it.folderId === activeFolderId)
                .map((it) => (
                  <div key={it.id} className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4 flex items-start justify-between gap-3">
                    <div className="space-y-1 min-w-0">
                      <div className="text-[11px] text-orange-500 font-semibold uppercase">{it.itemType}</div>
                      <div className="text-sm font-bold">{it.title}</div>
                      {it.summary && <p className="text-xs text-zinc-500">{it.summary}</p>}
                      {it.url && (
                        <a href={it.url} target="_blank" rel="noreferrer" className="text-xs text-orange-500 hover:underline inline-flex items-center gap-1">
                          <ExternalLink className="w-3 h-3" /> {it.url}
                        </a>
                      )}
                    </div>
                    <button
                      onClick={() =>
                        void apiFetch(`/api/ecosystem/vault/items/${it.id}`, { method: 'DELETE' }).then(() => loadTab())
                      }
                      className="p-2 text-zinc-400 hover:text-red-500"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                ))}
            </div>
          </div>
        </div>
      )}

      {/* CREATOR STUDIO */}
      {tab === 'studio' && studioData && (
        <div className="space-y-6">
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 tabular-nums">
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
              <div className="text-xs text-zinc-500">{lang === 'ar' ? 'المنشورات المنشورة' : 'Published'}</div>
              <div className="text-2xl font-display font-bold mt-1">{studioData.analytics.publishedCount}</div>
            </div>
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
              <div className="text-xs text-zinc-500">{lang === 'ar' ? 'إجمالي المشاهدات' : 'Total Views'}</div>
              <div className="text-2xl font-display font-bold text-orange-500 mt-1">{studioData.analytics.totalViews}</div>
            </div>
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
              <div className="text-xs text-zinc-500">{lang === 'ar' ? 'التفاعلات والتعليقات' : 'Engagements'}</div>
              <div className="text-2xl font-display font-bold mt-1">
                {studioData.analytics.totalReactions + studioData.analytics.totalComments}
              </div>
            </div>
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-4">
              <div className="text-xs text-zinc-500">{lang === 'ar' ? 'مجدول / مسودات' : 'Scheduled / Drafts'}</div>
              <div className="text-2xl font-display font-bold mt-1">
                {studioData.analytics.scheduledCount} / {studioData.analytics.draftsCount}
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-5">
            {/* Schedule Post */}
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <CalendarClock className="w-4 h-4 text-orange-500" />
                {lang === 'ar' ? 'جدولة منشور مستقبلي' : 'Schedule Post'}
              </h3>
              <textarea
                value={schedContent}
                onChange={(e) => setSchedContent(e.target.value)}
                rows={3}
                placeholder={lang === 'ar' ? 'اكتب محتوى المنشور المجدول...' : 'Write scheduled post content...'}
                className="w-full px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
              />
              <div className="flex flex-wrap gap-2">
                <input
                  type="datetime-local"
                  value={schedAt}
                  onChange={(e) => setSchedAt(e.target.value)}
                  className="px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                />
                <button
                  onClick={async () => {
                    if (!schedContent.trim() || !schedAt) return;
                    await apiFetch('/api/social/posts', {
                      method: 'POST',
                      body: JSON.stringify({ content: schedContent, scheduledAt: new Date(schedAt).toISOString() }),
                    });
                    setSchedContent('');
                    setSchedAt('');
                    await loadTab();
                    notifyToast(lang === 'ar' ? 'تمت جدولة المنشور' : 'Post scheduled!', 'success');
                  }}
                  className="px-4 py-2 rounded-xl bg-orange-500 text-white text-xs font-semibold"
                >
                  {lang === 'ar' ? 'جدولة النشر' : 'Schedule'}
                </button>
              </div>
            </div>

            {/* Cover Card Generator */}
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
              <h3 className="text-sm font-bold flex items-center gap-2">
                <BarChart3 className="w-4 h-4 text-orange-500" />
                {lang === 'ar' ? 'مصمم بطاقة الغلاف للمبدعين' : 'Creator Cover Card Builder'}
              </h3>
              <div
                className="rounded-xl p-6 text-white text-center font-display font-bold text-lg min-h-[100px] flex items-center justify-center"
                style={{ backgroundColor: coverBg }}
              >
                {coverTitle || (lang === 'ar' ? 'اكتب عنوان البطاقة للمعاينة' : 'Type card headline to preview')}
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <input
                  value={coverTitle}
                  onChange={(e) => setCoverTitle(e.target.value)}
                  placeholder={lang === 'ar' ? 'عنوان البطاقة...' : 'Card title...'}
                  className="flex-1 px-3 py-2 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
                />
                <input type="color" value={coverBg} onChange={(e) => setCoverBg(e.target.value)} className="w-9 h-9 rounded-lg cursor-pointer" />
                <button
                  onClick={() => {
                    if (!coverTitle.trim()) return;
                    setSchedContent((prev) => (prev ? `${coverTitle}\n\n${prev}` : coverTitle));
                    notifyToast(lang === 'ar' ? 'تم نقل العنوان إلى محرر النشر' : 'Copied headline to composer', 'info');
                  }}
                  className="px-3 py-2 rounded-xl border border-zinc-200 dark:border-zinc-800 text-xs font-semibold"
                >
                  {lang === 'ar' ? 'استخدام في منشور' : 'Use in Post'}
                </button>
              </div>
            </div>
          </div>

          {studioData.topPosts?.length > 0 && (
            <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 p-5 space-y-3">
              <h3 className="text-sm font-bold">{lang === 'ar' ? 'تحليلات أحدث المنشورات' : 'Recent Post Analytics'}</h3>
              <div className="space-y-2 tabular-nums">
                {studioData.topPosts.map((p: any) => (
                  <div key={p.id} className="p-3 rounded-xl bg-zinc-50 dark:bg-zinc-950 text-xs flex flex-wrap justify-between gap-2">
                    <span className="truncate max-w-md font-medium">{p.content}</span>
                    <span className="text-zinc-500 font-mono">
                      👁 {p.viewsCount} · 👍 {p.reactionsCount} · 💬 {p.commentsCount} · ↗ {p.sharesCount}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};
