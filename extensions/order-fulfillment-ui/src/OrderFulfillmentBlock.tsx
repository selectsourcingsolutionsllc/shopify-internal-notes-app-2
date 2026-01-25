import { useState, useEffect, useMemo } from 'react';
import {
  reactExtension,
  BlockStack,
  Button,
  Checkbox,
  Text,
  InlineStack,
  Badge,
  Banner,
  Box,
  Image,
  Link,
  useApi,
} from '@shopify/ui-extensions-react/admin';

// Hardcoded URL required for extensions (process.env not available in browser)
const BASE_URL = "https://product-notes-for-staff.up.railway.app";

// Use block.render so it shows automatically on the order page
const TARGET = 'admin.order-details.block.render';

export default reactExtension(TARGET, () => <OrderFulfillmentBlock />);

// Generate a random session ID (simple UUID-like string)
function generateSessionId(): string {
  return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, (c) => {
    const r = Math.random() * 16 | 0;
    const v = c === 'x' ? r : (r & 0x3 | 0x8);
    return v.toString(16);
  });
}

function OrderFulfillmentBlock() {
  const api = useApi(TARGET);
  const { data } = api;
  const [productNotes, setProductNotes] = useState<any[]>([]);
  const [acknowledgments, setAcknowledgments] = useState<Record<string, any>>({});
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [canFulfill, setCanFulfill] = useState(true);
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [currentNoteIndex, setCurrentNoteIndex] = useState(0);
  const [allProductIds, setAllProductIds] = useState<string[]>([]);

  // Generate a unique session ID when component mounts
  // This stays stable for the entire page session
  const sessionId = useMemo(() => generateSessionId(), []);

  // Try different ways to get the order ID
  const orderId = (data as any)?.selected?.[0]?.id || (data as any)?.order?.id;

  const [shopDomain, setShopDomain] = useState<string>('');

  // Fetch shop domain using Direct API Access (the correct Shopify way)
  const fetchShopDomain = async (): Promise<string> => {
    // First check if we already have it cached
    if (shopDomain) return shopDomain;

    // Try static properties first
    const staticShop =
      (api as any).shop?.myshopifyDomain ||
      (api as any).data?.shop?.myshopifyDomain ||
      (api as any).extension?.shop ||
      (api as any).host?.shop ||
      '';

    if (staticShop) {
      console.log('[Order Extension] Shop from static:', staticShop);
      setShopDomain(staticShop);
      return staticShop;
    }

    // Use Direct API Access - the official Shopify way for admin extensions
    // See: https://shopify.dev/docs/api/admin-extensions/latest/direct-api-access
    try {
      console.log('[Order Extension] Fetching shop via Direct API Access...');
      const response = await fetch('shopify:admin/api/graphql.json', {
        method: 'POST',
        body: JSON.stringify({
          query: `
            query GetShop {
              shop {
                myshopifyDomain
              }
            }
          `
        }),
      });

      const result = await response.json();
      console.log('[Order Extension] Shop GraphQL result:', JSON.stringify(result));

      if (result?.data?.shop?.myshopifyDomain) {
        const domain = result.data.shop.myshopifyDomain;
        setShopDomain(domain);
        return domain;
      }
    } catch (err) {
      console.error('[Order Extension] Shop GraphQL failed:', err);
    }

    console.log('[Order Extension] Could not get shop domain');
    return '';
  };

  useEffect(() => {
    const init = async () => {
      // Log API structure for debugging
      console.log('[Order Extension] Full API keys:', Object.keys(api));
      console.log('[Order Extension] Data:', JSON.stringify(data));
      console.log('[Order Extension] Order ID:', orderId);

      // Fetch shop domain first
      const shop = await fetchShopDomain();
      setDebugInfo(`Order: ${orderId || 'none'}, Shop: ${shop || 'none'}`);

      if (orderId && shop) {
        fetchOrderNotes();
        fetchSettings();
      } else if (!orderId) {
        setLoading(false);
        setError('No order ID found');
      } else if (!shop) {
        setLoading(false);
        setError('Could not determine shop domain');
      }
    };

    init();
  }, [orderId]);

  useEffect(() => {
    // Check if all required notes are acknowledged
    if (settings?.requireAcknowledgment && productNotes.length > 0) {
      const allAcknowledged = productNotes.every(note =>
        acknowledgments[note.id]?.acknowledged
      );
      setCanFulfill(allAcknowledged);
    }
  }, [productNotes, acknowledgments, settings]);

  const fetchOrderNotes = async () => {
    try {
      setLoading(true);
      console.log('[Order Extension] Starting fetchOrderNotes for order:', orderId);

      // Use Direct API Access to get order line items (the correct Shopify way)
      // See: https://shopify.dev/docs/api/admin-extensions/latest/direct-api-access
      let productIds: string[] = [];

      try {
        console.log('[Order Extension] Fetching order via Direct API Access...');
        const response = await fetch('shopify:admin/api/graphql.json', {
          method: 'POST',
          body: JSON.stringify({
            query: `
              query GetOrder($id: ID!) {
                order(id: $id) {
                  id
                  name
                  lineItems(first: 50) {
                    edges {
                      node {
                        product {
                          id
                        }
                      }
                    }
                  }
                }
              }
            `,
            variables: { id: orderId }
          }),
        });

        const result = await response.json();
        console.log('[Order Extension] GraphQL result:', JSON.stringify(result));

        if (result?.data?.order?.lineItems?.edges) {
          productIds = result.data.order.lineItems.edges
            .map((edge: any) => edge.node?.product?.id)
            .filter(Boolean);
        }

        // Check for GraphQL errors
        if (result?.errors) {
          console.error('[Order Extension] GraphQL errors:', result.errors);
        }
      } catch (queryErr) {
        console.error('[Order Extension] GraphQL query failed:', queryErr);
      }

      console.log('[Order Extension] Product IDs found:', productIds);

      // Save all product IDs for later use (when releasing hold)
      setAllProductIds(productIds);

      if (productIds.length === 0) {
        console.log('[Order Extension] No product IDs found');
        setProductNotes([]);
        setLoading(false);
        return;
      }

      // Get shop domain (should already be cached from init)
      const shop = shopDomain || await fetchShopDomain();
      if (!shop) {
        throw new Error('Shop domain not available');
      }

      const url = `${BASE_URL}/api/public/orders/${encodeURIComponent(orderId)}/notes?shop=${encodeURIComponent(shop)}`;

      console.log('[Order Extension] Fetching order notes:', url);
      console.log('[Order Extension] With productIds:', productIds);

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ productIds }),
      });

      console.log('[Order Extension] Response status:', response.status);

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch notes');
      }

      const responseData = await response.json();
      console.log('[Order Extension] Response data:', JSON.stringify(responseData));

      // FIRST: Check if hold needs to be re-applied (clears stale acknowledgments if session changed)
      // This must happen BEFORE we load acknowledgments into UI state
      let acknowledgementsWereCleared = false;
      if (productIds.length > 0) {
        acknowledgementsWereCleared = await checkAndReapplyHold(productIds);
      }

      setProductNotes(responseData.notes || []);

      // Initialize acknowledgments state
      // If acknowledgments were just cleared by check-hold, start with empty state
      if (acknowledgementsWereCleared) {
        const acks: Record<string, any> = {};
        (responseData.notes || []).forEach((note: any) => {
          acks[note.id] = { acknowledged: false };
        });
        setAcknowledgments(acks);
      } else {
        // The database record existing = acknowledged. Transform it to include acknowledged: true
        const acks: Record<string, any> = {};
        (responseData.notes || []).forEach((note: any) => {
          const existingAck = (responseData.acknowledgments || []).find((ack: any) =>
            ack.noteId === note.id && ack.orderId === orderId
          );
          if (existingAck) {
            // Acknowledgment exists in database = it's acknowledged
            acks[note.id] = {
              acknowledged: true,
              acknowledgedAt: existingAck.acknowledgedAt,
            };
          } else {
            acks[note.id] = { acknowledged: false };
          }
        });
        setAcknowledgments(acks);
      }

    } catch (err: any) {
      console.error('[Order Extension] Error fetching notes:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const shop = shopDomain || await fetchShopDomain();
      if (!shop) return; // Can't fetch without shop

      const url = `${BASE_URL}/api/public/settings?shop=${encodeURIComponent(shop)}`;

      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to fetch settings');

      const responseData = await response.json();
      setSettings(responseData.settings);
    } catch (err: any) {
      console.error('[Order Extension] Failed to fetch settings:', err);
    }
  };

  // Check if hold needs to be re-applied (called when extension loads)
  const checkAndReapplyHold = async (productIds: string[]): Promise<boolean> => {
    try {
      if (!orderId || productIds.length === 0) return false;

      const shop = shopDomain || await fetchShopDomain();
      if (!shop) return false;

      console.log('[Order Extension] Checking if hold needs to be re-applied... sessionId:', sessionId);

      const formData = new FormData();
      formData.append('orderId', orderId);
      formData.append('productIds', JSON.stringify(productIds));
      formData.append('sessionId', sessionId);

      const url = `${BASE_URL}/api/public/check-hold?shop=${encodeURIComponent(shop)}`;

      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) {
        console.error('[Order Extension] Check-hold request failed:', response.status);
        return false;
      }

      const result = await response.json();
      console.log('[Order Extension] Check-hold result:', result);

      // Return whether acknowledgments were cleared so caller can handle it
      if (result.holdApplied || result.acknowledgementsCleared) {
        console.log('[Order Extension] Acknowledgements were cleared');
        setCanFulfill(false);
        return true;
      }
      return false;
    } catch (err: any) {
      console.error('[Order Extension] Error checking hold:', err);
      return false;
    }
  };

  const handleAcknowledge = async (noteId: string) => {
    await submitAcknowledgment(noteId);
  };

  const submitAcknowledgment = async (noteId: string) => {
    try {
      const shop = shopDomain || await fetchShopDomain();
      if (!shop) {
        throw new Error('Shop domain not available');
      }

      const formData = new FormData();
      formData.append('noteId', noteId);
      formData.append('orderId', orderId);
      // Pass all product IDs so the server can check if all notes are acknowledged
      // and release the fulfillment hold if so
      formData.append('allProductIds', JSON.stringify(allProductIds));
      // Pass sessionId so server knows which session created this acknowledgment
      formData.append('sessionId', sessionId);

      const url = `${BASE_URL}/api/public/acknowledgments?shop=${encodeURIComponent(shop)}`;

      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to acknowledge note');

      const result = await response.json();

      // Update local state
      setAcknowledgments(prev => ({
        ...prev,
        [noteId]: {
          acknowledged: true,
          acknowledgedAt: new Date().toISOString(),
        },
      }));

      // If the hold was released, update canFulfill immediately
      if (result.holdReleased) {
        console.log('[Order Extension] Hold released! Order can now be fulfilled.');
        setCanFulfill(true);
      }

    } catch (err: any) {
      setError(err.message);
    }
  };

  if (loading) {
    return (
      <Box padding="none">
        <BlockStack gap="extraTight">
          <Text fontWeight="bold">Note</Text>
          <Text>Loading product notes...</Text>
        </BlockStack>
      </Box>
    );
  }

  if (error) {
    return (
      <Box padding="none">
        <BlockStack gap="extraTight">
          <Text fontWeight="bold">Note</Text>
          <Banner tone="critical">
            <Text>Error: {error}</Text>
          </Banner>
          <Button onPress={fetchOrderNotes}>Retry</Button>
        </BlockStack>
      </Box>
    );
  }

  if (productNotes.length === 0) {
    return (
      <Box padding="none">
        <BlockStack gap="extraTight">
          <Text fontWeight="bold">Note</Text>
          <Text emphasis="subdued">No notes for products in this order.</Text>
        </BlockStack>
      </Box>
    );
  }

  // Show one note at a time with navigation (keeps height constant)
  const currentNote = productNotes[currentNoteIndex];
  const ack = acknowledgments[currentNote?.id];
  const isAcknowledged = ack?.acknowledged;

  return (
    <Box padding="none">
      <BlockStack gap="extraTight">
        {settings?.blockFulfillment && !canFulfill && (
          <Banner
            title="Order On Hold"
            tone="critical"
          >
            <Text>
              This order is on hold. Acknowledge all product notes to release the hold and enable fulfillment.
            </Text>
          </Banner>
        )}

        <InlineStack blockAlignment="center">
          <Text fontWeight="bold">Note</Text>
          <Badge tone="warning">{currentNoteIndex + 1} / {productNotes.length}</Badge>
        </InlineStack>

        {/* Show acknowledgment UI only if requireAcknowledgment is enabled */}
        {settings?.requireAcknowledgment ? (
          <Banner tone="warning" title="Check box to acknowledge">
            <BlockStack gap="extraTight">
              {/* Checkbox with note content - always visible */}
              <Checkbox
                label={currentNote.content.length > 211 ? currentNote.content.substring(0, 211) + '...' : currentNote.content}
                checked={isAcknowledged}
                disabled={isAcknowledged}
                onChange={(checked: boolean) => {
                  if (checked) {
                    handleAcknowledge(currentNote.id);
                  }
                }}
              />

              {/* Acknowledged timestamp */}
              {isAcknowledged && ack.acknowledgedAt && (
                <InlineStack gap="extraTight">
                  <Badge tone="success">Acknowledged</Badge>
                  <Text emphasis="subdued">at {new Date(ack.acknowledgedAt).toLocaleString()}</Text>
                </InlineStack>
              )}

              {/* Photo thumbnail (if exists) */}
              {currentNote.photos && currentNote.photos.length > 0 && (
                <InlineStack gap="extraTight" blockAlignment="center">
                  <Link href={currentNote.photos[0].url} external>
                    <Image
                      source={currentNote.photos[0].thumbnailUrl || currentNote.photos[0].url}
                      alt="Note photo"
                    />
                  </Link>
                  {currentNote.photos.length > 1 && (
                    <Badge tone="info">+{currentNote.photos.length - 1} more</Badge>
                  )}
                </InlineStack>
              )}

              {/* Previous/Next buttons - always at bottom right, fixed position */}
              {productNotes.length > 1 && (
                <InlineStack gap="tight" inlineAlignment="center">
                  <Button
                    variant="primary"
                    disabled={currentNoteIndex === 0}
                    onPress={() => setCurrentNoteIndex(currentNoteIndex - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="primary"
                    disabled={currentNoteIndex === productNotes.length - 1}
                    onPress={() => setCurrentNoteIndex(currentNoteIndex + 1)}
                  >
                    Next
                  </Button>
                </InlineStack>
              )}
            </BlockStack>
          </Banner>
        ) : (
          /* Show notes as info-only when acknowledgment is NOT required */
          <Banner tone="info" title="Product Note">
            <BlockStack gap="extraTight">
              <Text>{currentNote.content.length > 211 ? currentNote.content.substring(0, 211) + '...' : currentNote.content}</Text>

              {/* Photo thumbnail (if exists) */}
              {currentNote.photos && currentNote.photos.length > 0 && (
                <InlineStack gap="extraTight" blockAlignment="center">
                  <Link href={currentNote.photos[0].url} external>
                    <Image
                      source={currentNote.photos[0].thumbnailUrl || currentNote.photos[0].url}
                      alt="Note photo"
                    />
                  </Link>
                  {currentNote.photos.length > 1 && (
                    <Badge tone="info">+{currentNote.photos.length - 1} more</Badge>
                  )}
                </InlineStack>
              )}

              {/* Previous/Next buttons - always at bottom right, fixed position */}
              {productNotes.length > 1 && (
                <InlineStack gap="tight" inlineAlignment="center">
                  <Button
                    variant="primary"
                    disabled={currentNoteIndex === 0}
                    onPress={() => setCurrentNoteIndex(currentNoteIndex - 1)}
                  >
                    Previous
                  </Button>
                  <Button
                    variant="primary"
                    disabled={currentNoteIndex === productNotes.length - 1}
                    onPress={() => setCurrentNoteIndex(currentNoteIndex + 1)}
                  >
                    Next
                  </Button>
                </InlineStack>
              )}
            </BlockStack>
          </Banner>
        )}
      </BlockStack>
    </Box>
  );
}
