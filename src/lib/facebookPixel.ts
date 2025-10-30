// Facebook Pixel Helper Functions
// Replace 'YOUR_PIXEL_ID' with your actual Facebook Pixel ID

declare global {
  interface Window {
    fbq: any;
  }
}

export const FB_PIXEL_ID = 'YOUR_PIXEL_ID'; // TODO: Replace with your actual Pixel ID

export const initFacebookPixel = () => {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('init', FB_PIXEL_ID);
    window.fbq('track', 'PageView');
  }
};

export const trackInitiateCheckout = (productData: {
  productId: string;
  productName: string;
  value: number;
  currency?: string;
}) => {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', 'InitiateCheckout', {
      content_ids: [productData.productId],
      content_name: productData.productName,
      value: productData.value,
      currency: productData.currency || 'BRL',
    });
    console.log('Facebook Pixel: InitiateCheckout tracked', productData);
  }
};

export const trackPurchase = (purchaseData: {
  value: number;
  currency?: string;
  productId: string;
  productName: string;
  tokensGranted: number;
  transactionId: string;
}) => {
  if (typeof window !== 'undefined' && window.fbq) {
    // Check if already tracked to avoid duplicates
    const trackedPurchases = JSON.parse(localStorage.getItem('fb_tracked_purchases') || '[]');
    
    if (trackedPurchases.includes(purchaseData.transactionId)) {
      console.log('Facebook Pixel: Purchase already tracked', purchaseData.transactionId);
      return;
    }

    window.fbq('track', 'Purchase', {
      value: purchaseData.value,
      currency: purchaseData.currency || 'BRL',
      content_ids: [purchaseData.productId],
      content_name: purchaseData.productName,
      num_items: purchaseData.tokensGranted,
      transaction_id: purchaseData.transactionId,
    });

    // Mark as tracked
    trackedPurchases.push(purchaseData.transactionId);
    localStorage.setItem('fb_tracked_purchases', JSON.stringify(trackedPurchases));
    
    console.log('Facebook Pixel: Purchase tracked', purchaseData);
  }
};

export const trackViewContent = (contentData: {
  contentName: string;
  contentCategory?: string;
  contentIds?: string[];
}) => {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', 'ViewContent', {
      content_name: contentData.contentName,
      content_category: contentData.contentCategory,
      content_ids: contentData.contentIds,
    });
    console.log('Facebook Pixel: ViewContent tracked', contentData);
  }
};

export const trackLead = () => {
  if (typeof window !== 'undefined' && window.fbq) {
    window.fbq('track', 'Lead');
    console.log('Facebook Pixel: Lead tracked');
  }
};
