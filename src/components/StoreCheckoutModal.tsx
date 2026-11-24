import React, { useState, useEffect, useMemo } from 'react';
import QRCode from 'qrcode';
import {
  X,
  CreditCard,
  Truck,
  Landmark,
  Copy,
  Check,
  Upload,
  ExternalLink,
  AlertTriangle,
  Share2,
  QrCode,
  ShieldCheck,
} from 'lucide-react';
import { apiFetch } from '../lib/api';

interface BankAppOption {
  id: string;
  ar: string;
  en: string;
  badge: string;
  schemeUrl: string;
  webUrl: string;
}

const BANK_APPS: BankAppOption[] = [
  { id: 'alrajhi', ar: 'مصرف الراجحي', en: 'Al Rajhi Bank', badge: 'AR', schemeUrl: 'alrajhibank://', webUrl: 'https://www.alrajhibank.com.sa' },
  { id: 'snb', ar: 'البنك الأهلي SNB', en: 'SNB AlAhli', badge: 'SNB', schemeUrl: 'alahlimobile://', webUrl: 'https://www.alahli.com' },
  { id: 'alinma', ar: 'مصرف الإنماء', en: 'Alinma Bank', badge: 'IN', schemeUrl: 'alinma://', webUrl: 'https://www.alinma.com' },
  { id: 'riyad', ar: 'بنك الرياض', en: 'Riyad Bank', badge: 'RY', schemeUrl: 'riyadmobile://', webUrl: 'https://www.riyadbank.com' },
  { id: 'stcpay', ar: 'stc bank / Pay', en: 'stc bank / Pay', badge: 'STC', schemeUrl: 'stcpay://', webUrl: 'https://www.stcpay.com.sa' },
  { id: 'urpay', ar: 'Urpay يورباي', en: 'Urpay', badge: 'UR', schemeUrl: 'urpay://', webUrl: 'https://www.urpay.com.sa' },
  { id: 'banquemisr', ar: 'بنك مصر', en: 'Banque Misr', badge: 'BM', schemeUrl: 'bmwallet://', webUrl: 'https://www.banquemisr.com' },
  { id: 'cib', ar: 'البنك التجاري CIB', en: 'CIB Egypt', badge: 'CIB', schemeUrl: 'cibmobile://', webUrl: 'https://www.cibeg.com' },
  { id: 'qnb', ar: 'بنك قطر الوطني QNB', en: 'QNB Mobile', badge: 'QNB', schemeUrl: 'qnbmobile://', webUrl: 'https://www.qnb.com' },
  { id: 'other', ar: 'تطبيق بنك آخر', en: 'Other Bank App', badge: 'BNK', schemeUrl: '', webUrl: '' },
];

export interface CheckoutTarget {
  mode: 'direct' | 'cart';
  product?: any;
  cartItems?: any[];
  store: any;
}

export const StoreCheckoutModal: React.FC<{
  lang: 'ar' | 'en';
  target: CheckoutTarget;
  onClose: () => void;
  onCompleted: () => Promise<void> | void;
  notifyToast: (msg: string, type?: 'success' | 'error' | 'info') => void;
}> = ({ lang, target, onClose, onCompleted, notifyToast }) => {
  const store = target.store;
  const hasBankDetails = Boolean(store?.iban || store?.accountNumber);

  const allowCod =
    target.mode === 'direct'
      ? target.product?.allowCod !== false
      : (target.cartItems || []).every((c) => c.product?.allowCod !== false);

  const allowBank =
    target.mode === 'direct'
      ? target.product?.allowBankTransfer !== false && hasBankDetails
      : (target.cartItems || []).every((c) => c.product?.allowBankTransfer !== false) && hasBankDetails;

  const [quantity, setQuantity] = useState(1);
  const [shippingAddress, setShippingAddress] = useState('');
  const [note, setNote] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<'cod' | 'bank_transfer'>(
    allowBank ? 'bank_transfer' : 'cod'
  );
  const [selectedBankApp, setSelectedBankApp] = useState<string>('alrajhi');
  const [transferRef] = useState(() => `TGR-${Math.random().toString(36).slice(2, 8).toUpperCase()}`);
  const [receiptUrl, setReceiptUrl] = useState('');
  const [receiptName, setReceiptName] = useState('');
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [qrDataUrl, setQrDataUrl] = useState('');
  const [launchedAppHint, setLaunchedAppHint] = useState(false);

  const pricing = useMemo(() => {
    if (target.mode === 'direct' && target.product) {
      const p = target.product;
      const unit = Number((p.priceUsd * (1 - (p.discountPercent || 0) / 100)).toFixed(2));
      const subtotal = Number((unit * quantity).toFixed(2));
      const delivery = Number((p.deliveryFeeUsd || 0).toFixed(2));
      return { subtotal, delivery, total: Number((subtotal + delivery).toFixed(2)) };
    }
    const items = target.cartItems || [];
    const subtotal = Number(
      items
        .reduce((acc, c) => {
          const p = c.product;
          if (!p) return acc;
          const unit = p.priceUsd * (1 - (p.discountPercent || 0) / 100);
          return acc + unit * c.quantity;
        }, 0)
        .toFixed(2)
    );
    const delivery = Number(
      items.reduce((acc, c) => acc + (c.product?.deliveryFeeUsd || 0), 0).toFixed(2)
    );
    return { subtotal, delivery, total: Number((subtotal + delivery).toFixed(2)) };
  }, [target, quantity]);

  const [transferredAmount, setTransferredAmount] = useState<string>(() => pricing.total.toFixed(2));

  useEffect(() => {
    setTransferredAmount(pricing.total.toFixed(2));
  }, [pricing.total]);

  const bankPayloadText = useMemo(() => {
    return [
      `Store: ${store?.name || ''}`,
      `Bank: ${store?.bankName || ''}`,
      `Beneficiary: ${store?.accountHolderName || ''}`,
      store?.iban ? `IBAN: ${store.iban}` : '',
      store?.accountNumber ? `Account: ${store.accountNumber}` : '',
      `Amount: ${pricing.total.toFixed(2)} USD`,
      `Ref: ${transferRef}`,
    ]
      .filter(Boolean)
      .join('\n');
  }, [store, pricing.total, transferRef]);

  useEffect(() => {
    if (paymentMethod !== 'bank_transfer' || !hasBankDetails) return;
    QRCode.toDataURL(bankPayloadText, { width: 180, margin: 1 })
      .then((url) => setQrDataUrl(url))
      .catch(() => setQrDataUrl(''));
  }, [paymentMethod, hasBankDetails, bankPayloadText]);

  const copyText = async (val: string, key: string) => {
    try {
      await navigator.clipboard.writeText(val);
      setCopiedKey(key);
      notifyToast(lang === 'ar' ? 'تم النسخ للحافظة' : 'Copied to clipboard', 'success');
      setTimeout(() => setCopiedKey(null), 2000);
    } catch {
      notifyToast(lang === 'ar' ? 'تعذر النسخ التلقائي' : 'Copy unavailable', 'error');
    }
  };

  const handleOpenBankApp = async () => {
    const bank = BANK_APPS.find((b) => b.id === selectedBankApp) || BANK_APPS[0];
    const targetAccount = store?.iban || store?.accountNumber || '';
    const smartClip = targetAccount
      ? `${targetAccount}\nAmount: $${pricing.total.toFixed(2)}\nRef: ${transferRef}`
      : bankPayloadText;

    try {
      await navigator.clipboard.writeText(smartClip);
    } catch {
      // Clipboard may require explicit gesture on some browsers
    }

    setLaunchedAppHint(true);

    if (typeof navigator !== 'undefined' && navigator.share && selectedBankApp === 'other') {
      try {
        await navigator.share({
          title: `Bank Transfer - ${store?.name || 'TIGER STORE'}`,
          text: bankPayloadText,
        });
        return;
      } catch {
        // User cancelled share sheet
      }
    }

    if (bank.schemeUrl) {
      const a = document.createElement('a');
      a.href = bank.schemeUrl;
      a.rel = 'noopener noreferrer';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
    }

    notifyToast(
      lang === 'ar'
        ? `تم نسخ رقم الحساب والمبلغ ($${pricing.total.toFixed(2)}) ومحاولة فتح ${bank.ar}. ألصق الحساب في تطبيق البنك ثم ارفع الإيصال هنا.`
        : `Account & amount ($${pricing.total.toFixed(2)}) copied! Launching ${bank.en}. Paste details in your bank app, transfer, then upload receipt below.`,
      'info'
    );
  };

  const handleUploadReceipt = async (file: File) => {
    setUploadingReceipt(true);
    try {
      const fd = new FormData();
      fd.append('file', file);
      const res = await apiFetch<{ url: string; originalName: string }>('/api/store/receipts/upload', {
        method: 'POST',
        body: fd,
      });
      setReceiptUrl(res.url);
      setReceiptName(res.originalName || file.name);
      notifyToast(lang === 'ar' ? 'تم رفع إيصال التحويل بنجاح' : 'Transfer receipt uploaded!', 'success');
    } catch (err: any) {
      notifyToast(err?.message || 'Receipt upload failed', 'error');
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleSubmitOrder = async () => {
    if (!shippingAddress.trim()) {
      return notifyToast(
        lang === 'ar' ? 'أدخل عنوان التوصيل أو رقم التواصل' : 'Enter shipping address or contact',
        'error'
      );
    }
    if (paymentMethod === 'bank_transfer' && !receiptUrl) {
      return notifyToast(
        lang === 'ar' ? 'يرجى رفع إيصال التحويل البنكي للتأكد من الدفع' : 'Please upload the bank transfer receipt first',
        'error'
      );
    }

    setSubmitting(true);
    try {
      const payload = {
        shippingAddress: shippingAddress.trim(),
        note: note.trim(),
        paymentMethod,
        selectedBankApp: paymentMethod === 'bank_transfer' ? selectedBankApp : '',
        transferReference: paymentMethod === 'bank_transfer' ? transferRef : '',
        transferredAmountUsd: paymentMethod === 'bank_transfer' ? Number(transferredAmount || 0) : 0,
        transferReceiptUrl: paymentMethod === 'bank_transfer' ? receiptUrl : '',
      };

      if (target.mode === 'direct' && target.product) {
        await apiFetch('/api/store/orders/direct', {
          method: 'POST',
          body: JSON.stringify({
            ...payload,
            productId: target.product.id,
            quantity,
          }),
        });
      } else {
        await apiFetch('/api/store/orders/checkout', {
          method: 'POST',
          body: JSON.stringify(payload),
        });
      }

      await onCompleted();
      notifyToast(
        paymentMethod === 'bank_transfer'
          ? lang === 'ar'
            ? 'تم إرسال الطلب وإيصال التحويل للبائع للمراجعة!'
            : 'Order & bank receipt sent to seller for verification!'
          : lang === 'ar'
          ? 'تم تأكيد طلبك (الدفع عند الاستلام)!'
          : 'Order placed (Cash on Delivery)!',
        'success'
      );
      onClose();
    } catch (err: any) {
      notifyToast(err?.message || 'Failed to place order', 'error');
    } finally {
      setSubmitting(false);
    }
  };

  const parsedTransferred = Number(transferredAmount || 0);
  const isShortTransfer = paymentMethod === 'bank_transfer' && parsedTransferred + 0.01 < pricing.total;

  return (
    <div className="fixed inset-0 z-50 bg-black/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-5 overflow-y-auto">
      <div className="w-full max-w-2xl rounded-3xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 shadow-2xl overflow-hidden my-auto">
        <div className="flex items-center justify-between px-5 py-4 border-b border-zinc-200 dark:border-zinc-800">
          <div>
            <h3 className="text-base font-display font-bold">
              {lang === 'ar' ? 'إتمام الشراء والدفع' : 'Complete Purchase & Payment'}
            </h3>
            <p className="text-xs text-zinc-500">
              {target.mode === 'direct' ? target.product?.title : `${target.cartItems?.length || 0} items`} · {store?.name}
            </p>
          </div>
          <button type="button" onClick={onClose} className="p-2 rounded-xl hover:bg-zinc-100 dark:hover:bg-zinc-800">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-5 max-h-[82vh] overflow-y-auto">
          {/* Quantity & Price Breakdown */}
          <div className="rounded-2xl bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800 p-4 space-y-2 text-xs tabular-nums">
            {target.mode === 'direct' && target.product && (
              <div className="flex items-center justify-between pb-2 border-b border-zinc-200 dark:border-zinc-800">
                <span className="font-semibold">{lang === 'ar' ? 'الكمية المطلوبة' : 'Quantity'}</span>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.max(1, q - 1))}
                    className="w-7 h-7 rounded-lg border border-zinc-300 dark:border-zinc-700 font-bold"
                  >
                    -
                  </button>
                  <span className="w-6 text-center font-mono font-bold">{quantity}</span>
                  <button
                    type="button"
                    onClick={() => setQuantity((q) => Math.min(target.product.stock || 50, q + 1))}
                    className="w-7 h-7 rounded-lg border border-zinc-300 dark:border-zinc-700 font-bold"
                  >
                    +
                  </button>
                </div>
              </div>
            )}
            <div className="flex justify-between text-zinc-500">
              <span>{lang === 'ar' ? 'سعر البضاعة' : 'Products Subtotal'}</span>
              <span className="font-mono">${pricing.subtotal.toFixed(2)}</span>
            </div>
            <div className="flex justify-between text-zinc-500">
              <span>{lang === 'ar' ? 'رسوم التوصيل المحددة من البائع' : 'Seller Delivery Fee'}</span>
              <span className="font-mono">{pricing.delivery > 0 ? `$${pricing.delivery.toFixed(2)}` : lang === 'ar' ? 'مجاني' : 'Free'}</span>
            </div>
            <div className="flex justify-between text-sm font-bold pt-1 border-t border-zinc-200 dark:border-zinc-800">
              <span>{lang === 'ar' ? 'الإجمالي المطلوب' : 'Total Due'}</span>
              <span className="font-mono text-orange-500">${pricing.total.toFixed(2)}</span>
            </div>
          </div>

          {/* Shipping Info */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <input
              value={shippingAddress}
              onChange={(e) => setShippingAddress(e.target.value)}
              placeholder={lang === 'ar' ? 'عنوان التوصيل ورقم الجوال *' : 'Delivery address & phone *'}
              className="px-3.5 py-2.5 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
            />
            <input
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={lang === 'ar' ? 'ملاحظات للبائع (اختياري)' : 'Notes for seller (optional)'}
              className="px-3.5 py-2.5 rounded-xl text-xs bg-zinc-50 dark:bg-zinc-950 border border-zinc-200 dark:border-zinc-800"
            />
          </div>

          {/* Payment Method Toggle */}
          <div className="space-y-2">
            <div className="text-xs font-bold">{lang === 'ar' ? 'اختر طريقة الدفع' : 'Select Payment Method'}</div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <button
                type="button"
                disabled={!allowBank}
                onClick={() => setPaymentMethod('bank_transfer')}
                className={`p-3.5 rounded-2xl border text-start transition flex items-start gap-3 disabled:opacity-40 ${
                  paymentMethod === 'bank_transfer'
                    ? 'border-orange-500 bg-orange-500/10'
                    : 'border-zinc-200 dark:border-zinc-800'
                }`}
              >
                <CreditCard className="w-5 h-5 text-orange-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold">{lang === 'ar' ? 'الدفع أونلاين (تحويل بنكي)' : 'Online Payment (Bank Transfer)'}</div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">
                    {hasBankDetails
                      ? lang === 'ar'
                        ? 'اختر تطبيق البنك، حوّل الحساب، وارفع الإيصال'
                        : 'Launch bank app, transfer & upload receipt'
                      : lang === 'ar'
                      ? 'البائع لم يضف حساباً بنكياً بعد'
                      : 'Seller has not added bank details yet'}
                  </div>
                </div>
              </button>

              <button
                type="button"
                disabled={!allowCod}
                onClick={() => setPaymentMethod('cod')}
                className={`p-3.5 rounded-2xl border text-start transition flex items-start gap-3 disabled:opacity-40 ${
                  paymentMethod === 'cod'
                    ? 'border-emerald-500 bg-emerald-500/10'
                    : 'border-zinc-200 dark:border-zinc-800'
                }`}
              >
                <Truck className="w-5 h-5 text-emerald-500 shrink-0 mt-0.5" />
                <div>
                  <div className="text-xs font-bold">{lang === 'ar' ? 'الدفع عند الاستلام' : 'Cash on Delivery (COD)'}</div>
                  <div className="text-[11px] text-zinc-500 mt-0.5">
                    {lang === 'ar' ? 'ادفع المبلغ نقداً عند وصول الطلب إليك' : 'Pay cash upon physical delivery'}
                  </div>
                </div>
              </button>
            </div>
          </div>

          {/* Online Bank Transfer Flow */}
          {paymentMethod === 'bank_transfer' && hasBankDetails && (
            <div className="space-y-4 rounded-2xl border border-orange-500/35 bg-orange-500/5 p-4">
              {/* 1. Choose Bank App */}
              <div className="space-y-2">
                <div className="text-xs font-bold flex items-center gap-1.5">
                  <Landmark className="w-4 h-4 text-orange-500" />
                  <span>{lang === 'ar' ? '1. اختر تطبيق البنك الذي تريد التحويل منه' : '1. Choose your Bank App'}</span>
                </div>
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-2">
                  {BANK_APPS.map((b) => (
                    <button
                      key={b.id}
                      type="button"
                      onClick={() => setSelectedBankApp(b.id)}
                      className={`p-2 rounded-xl border text-center transition ${
                        selectedBankApp === b.id
                          ? 'border-orange-500 bg-orange-500 text-white'
                          : 'border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-orange-500/50'
                      }`}
                    >
                      <div className="text-[10px] font-mono font-extrabold opacity-80">{b.badge}</div>
                      <div className="text-[11px] font-semibold truncate mt-0.5">{lang === 'ar' ? b.ar : b.en}</div>
                    </button>
                  ))}
                </div>
              </div>

              {/* 2. Seller Bank Account + QR + Auto-Copy Launcher */}
              <div className="grid grid-cols-1 sm:grid-cols-12 gap-4 items-center rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 p-4">
                <div className="sm:col-span-8 space-y-2 text-xs">
                  <div className="font-bold text-orange-500">
                    {lang === 'ar' ? 'بيانات الحساب البنكي للبائع' : 'Seller Bank Account Details'}
                  </div>
                  <div className="grid grid-cols-1 gap-1.5">
                    <div>
                      <span className="text-zinc-500">{lang === 'ar' ? 'البنك: ' : 'Bank: '}</span>
                      <span className="font-semibold">{store.bankName || '-'}</span>
                    </div>
                    <div>
                      <span className="text-zinc-500">{lang === 'ar' ? 'اسم المستفيد: ' : 'Beneficiary: '}</span>
                      <span className="font-semibold">{store.accountHolderName || store.name}</span>
                    </div>
                    {store.iban && (
                      <div className="flex items-center justify-between gap-2 bg-zinc-50 dark:bg-zinc-950 px-2.5 py-1.5 rounded-lg">
                        <span className="font-mono text-[11px] truncate">IBAN: {store.iban}</span>
                        <button
                          type="button"
                          onClick={() => void copyText(store.iban, 'iban')}
                          className="text-orange-500 shrink-0 inline-flex items-center gap-1 font-semibold"
                        >
                          {copiedKey === 'iban' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{lang === 'ar' ? 'نسخ' : 'Copy'}</span>
                        </button>
                      </div>
                    )}
                    {store.accountNumber && (
                      <div className="flex items-center justify-between gap-2 bg-zinc-50 dark:bg-zinc-950 px-2.5 py-1.5 rounded-lg">
                        <span className="font-mono text-[11px] truncate">
                          {lang === 'ar' ? 'رقم الحساب: ' : 'Account: '}
                          {store.accountNumber}
                        </span>
                        <button
                          type="button"
                          onClick={() => void copyText(store.accountNumber, 'acct')}
                          className="text-orange-500 shrink-0 inline-flex items-center gap-1 font-semibold"
                        >
                          {copiedKey === 'acct' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                          <span>{lang === 'ar' ? 'نسخ' : 'Copy'}</span>
                        </button>
                      </div>
                    )}
                    <div className="flex items-center justify-between gap-2 bg-zinc-50 dark:bg-zinc-950 px-2.5 py-1.5 rounded-lg tabular-nums">
                      <span className="font-mono text-[11px]">
                        {lang === 'ar' ? 'المرجع: ' : 'Ref: '}
                        {transferRef} · ${pricing.total.toFixed(2)}
                      </span>
                      <button
                        type="button"
                        onClick={() => void copyText(bankPayloadText, 'all')}
                        className="text-orange-500 shrink-0 inline-flex items-center gap-1 font-semibold"
                      >
                        {copiedKey === 'all' ? <Check className="w-3.5 h-3.5" /> : <Copy className="w-3.5 h-3.5" />}
                        <span>{lang === 'ar' ? 'نسخ الكل' : 'Copy All'}</span>
                      </button>
                    </div>
                  </div>
                  {store.bankNotes && <p className="text-[11px] text-zinc-500">{store.bankNotes}</p>}
                </div>

                <div className="sm:col-span-4 flex flex-col items-center justify-center gap-1.5">
                  {qrDataUrl ? (
                    <img src={qrDataUrl} alt="Bank Transfer QR" className="w-28 h-28 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white p-1" />
                  ) : (
                    <div className="w-28 h-28 rounded-xl border border-zinc-200 dark:border-zinc-700 flex items-center justify-center">
                      <QrCode className="w-8 h-8 text-zinc-400" />
                    </div>
                  )}
                  <span className="text-[10px] text-zinc-500 text-center">
                    {lang === 'ar' ? 'امسح QR أو انسخ الآيبان' : 'Scan QR or Copy IBAN'}
                  </span>
                </div>
              </div>

              {/* Open Bank App Button */}
              <div className="space-y-2">
                <div className="flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={() => void handleOpenBankApp()}
                    className="flex-1 py-2.5 px-4 rounded-xl bg-zinc-900 dark:bg-zinc-100 text-white dark:text-zinc-900 text-xs font-bold inline-flex items-center justify-center gap-2"
                  >
                    <ExternalLink className="w-4 h-4" />
                    <span>
                      {lang === 'ar'
                        ? 'شراء وفتح تطبيق البنك مع نسخ الحساب والمبلغ'
                        : 'Open Bank App & Auto-Copy Account'}
                    </span>
                  </button>
                  {typeof navigator !== 'undefined' && Boolean(navigator.share) && (
                    <button
                      type="button"
                      onClick={() =>
                        void navigator.share({ title: store.name, text: bankPayloadText }).catch(() => undefined)
                      }
                      className="px-3.5 py-2.5 rounded-xl border border-zinc-300 dark:border-zinc-700 text-xs font-semibold inline-flex items-center gap-1.5"
                    >
                      <Share2 className="w-4 h-4" />
                      <span>{lang === 'ar' ? 'مشاركة' : 'Share'}</span>
                    </button>
                  )}
                </div>
                {launchedAppHint && (
                  <p className="text-[11px] text-zinc-500 leading-relaxed">
                    {lang === 'ar'
                      ? 'تم تجهيز ونسخ رقم الحساب/الآيبان والمبلغ في الحافظة ليتعرف عليه تطبيق البنك فور اللصق (تمنع المتصفحات الحقن المباشر داخل التطبيقات البنكية لأسباب أمنية). بعد إتمام التحويل ارفع صورة الإيصال أدناه.'
                      : 'IBAN/Account & exact amount are copied to your clipboard so your bank app picks them up on paste (browsers restrict direct writes into private banking apps). After transferring, upload your receipt below.'}
                  </p>
                )}
              </div>

              {/* 3. Upload Receipt + Transferred Amount */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-orange-500/20">
                <div className="space-y-1.5">
                  <label className="text-xs font-bold block">
                    {lang === 'ar' ? '2. المبلغ الذي حوّلته فعلياً ($)' : '2. Amount Actually Transferred ($)'}
                  </label>
                  <input
                    type="number"
                    step="0.01"
                    min="0"
                    value={transferredAmount}
                    onChange={(e) => setTransferredAmount(e.target.value)}
                    className="w-full px-3 py-2 rounded-xl text-xs font-mono bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800"
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs font-bold block">
                    {lang === 'ar' ? '3. رفع إيصال التحويل البنكي *' : '3. Upload Transfer Receipt *'}
                  </label>
                  <label className="w-full px-3 py-2 rounded-xl border border-dashed border-orange-500/60 bg-white dark:bg-zinc-900 text-xs font-semibold cursor-pointer flex items-center justify-center gap-2 hover:bg-orange-500/5">
                    <Upload className="w-4 h-4 text-orange-500" />
                    <span className="truncate">
                      {uploadingReceipt
                        ? lang === 'ar'
                          ? 'جاري الرفع...'
                          : 'Uploading...'
                        : receiptName || (lang === 'ar' ? 'اختر صورة أو PDF للإيصال' : 'Choose Receipt Image / PDF')}
                    </span>
                    <input
                      type="file"
                      accept="image/*,application/pdf"
                      onChange={(e) => e.target.files?.[0] && void handleUploadReceipt(e.target.files[0])}
                      className="hidden"
                    />
                  </label>
                </div>
              </div>

              {receiptUrl && (
                <div className="flex items-center gap-2 text-xs text-emerald-500 font-semibold">
                  <ShieldCheck className="w-4 h-4" />
                  <span>{lang === 'ar' ? 'تم إرفاق الإيصال للمراجعة' : 'Receipt attached for seller verification'}</span>
                </div>
              )}

              {isShortTransfer && (
                <div className="rounded-xl bg-amber-500/15 border border-amber-500/40 p-3 text-xs text-amber-600 dark:text-amber-300 flex items-start gap-2">
                  <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5 text-amber-500" />
                  <span>
                    {lang === 'ar'
                      ? `تنبيه: المبلغ المحوّل ($${parsedTransferred.toFixed(2)}) أقل من إجمالي الطلب ($${pricing.total.toFixed(2)}). إذا لم يتم تحويل كامل المبلغ، سيضطر البائع لإلغاء الطلبية وإرجاع المبلغ المحوّل مسبقاً.`
                      : `Notice: Transferred amount ($${parsedTransferred.toFixed(2)}) is less than the order total ($${pricing.total.toFixed(2)}). The seller may cancel the order and refund your transferred amount.`}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Final Confirm Action */}
          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2.5 rounded-xl border border-zinc-200 dark:border-zinc-700 text-xs font-semibold"
            >
              {lang === 'ar' ? 'إلغاء' : 'Cancel'}
            </button>
            <button
              type="button"
              disabled={submitting || uploadingReceipt}
              onClick={() => void handleSubmitOrder()}
              className="px-6 py-2.5 rounded-xl bg-orange-500 hover:bg-orange-600 disabled:opacity-50 text-white text-xs font-bold"
            >
              {submitting
                ? lang === 'ar'
                  ? 'جاري إرسال الطلب...'
                  : 'Submitting...'
                : paymentMethod === 'bank_transfer'
                ? lang === 'ar'
                  ? 'تأكيد الشراء وإرسال الإيصال'
                  : 'Submit Order & Receipt'
                : lang === 'ar'
                ? 'تأكيد الطلب (عند الاستلام)'
                : 'Confirm COD Order'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
