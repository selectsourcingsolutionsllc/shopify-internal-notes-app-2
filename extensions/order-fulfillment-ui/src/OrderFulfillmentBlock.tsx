import { useState, useEffect } from 'react';
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

function OrderFulfillmentBlock() {
  const api = useApi(TARGET);
  const { data } = api;
  const [productNotes, setProductNotes] = useState<any[]>([]);
  const [acknowledgments, setAcknowledgments] = useState<Record<string, any>>({});
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null);
  const [canFulfill, setCanFulfill] = useState(false); // Start false - must acknowledge first
  const [debugInfo, setDebugInfo] = useState<string>('');
  const [orderProductIds, setOrderProductIds] = useState<string[]>([]);
  const [holdSecured, setHoldSecured] = useState(false); // Track if hold has been re-applied
  const [holdReleased, setHoldReleased] = useState(false); // Track if user has released the hold
  const [releasingHold, setReleasingHold] = useState(false); // Track if release is in progress
  const [pendingAcknowledgments, setPendingAcknowledgments] = useState<Set<string>>(new Set()); // Track notes being acknowledged

  const orderId = data.selected?.[0]?.id;

  // Try to get shop domain from multiple sources
  const getShopDomain = (): string => {
    const possibleShop =
      (api as any).shop?.myshopifyDomain ||
      (api as any).data?.shop?.myshopifyDomain ||
      (api as any).extension?.shop ||
      (api as any).host?.shop ||
      '';
    return possibleShop;
  };

  useEffect(() => {
    const shop = getShopDomain();
    setDebugInfo(`Order: ${orderId || 'none'}, Shop: ${shop || 'none'}`);

    if (orderId) {
      // Reset acknowledgments first, then fetch notes
      // This ensures every person viewing the order sees notes fresh
      resetAndFetchNotes();
      fetchSettings();
    } else {
      setLoading(false);
    }
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

      // Use GraphQL query to get order line items
      let productIds: string[] = [];

      try {
        const query = (api as any).query;
        if (query) {
          const result = await query(`
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
          `, { variables: { id: orderId } });

          if (result?.data?.order?.lineItems?.edges) {
            productIds = result.data.order.lineItems.edges
              .map((edge: any) => edge.node?.product?.id)
              .filter(Boolean);
          }
        }
      } catch (queryErr) {
        // GraphQL query failed - continue without product IDs
      }

      if (productIds.length === 0) {
        setProductNotes([]);
        setLoading(false);
        return;
      }

      const shop = getShopDomain();
      const url = `${BASE_URL}/api/public/orders/${encodeURIComponent(orderId)}/notes${shop ? `?shop=${encodeURIComponent(shop)}` : ''}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ productIds }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch notes');
      }

      const responseData = await response.json();

      setProductNotes(responseData.notes || []);

      // Initialize acknowledgments state
      const acks: Record<string, any> = {};
      (responseData.notes || []).forEach((note: any) => {
        acks[note.id] = (responseData.acknowledgments || []).find((ack: any) =>
          ack.noteId === note.id && ack.orderId === orderId
        ) || { acknowledged: false };
      });
      setAcknowledgments(acks);

    } catch (err: any) {
      console.error('[Order Extension] Error fetching notes:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchSettings = async () => {
    try {
      const shop = getShopDomain();
      const url = `${BASE_URL}/api/public/settings${shop ? `?shop=${encodeURIComponent(shop)}` : ''}`;

      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
        },
      });

      if (!response.ok) throw new Error('Failed to fetch settings');

      const responseData = await response.json();
      setSettings(responseData.settings);
    } catch (err: any) {
      console.error('[Extension] Failed to fetch settings:', err);
    }
  };

  // Reset acknowledgments and re-apply hold when page loads
  // This ensures every person viewing the order must acknowledge notes
  const resetAndFetchNotes = async () => {
    try {
      setLoading(true);

      // First, get product IDs via GraphQL
      let productIds: string[] = [];

      try {
        const query = (api as any).query;
        if (query) {
          const result = await query(`
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
          `, { variables: { id: orderId } });

          if (result?.data?.order?.lineItems?.edges) {
            productIds = result.data.order.lineItems.edges
              .map((edge: any) => edge.node?.product?.id)
              .filter(Boolean);
          }
        }
      } catch (queryErr) {
        // GraphQL query failed - continue without product IDs
      }

      if (productIds.length === 0) {
        setProductNotes([]);
        setLoading(false);
        return;
      }

      // Save product IDs to state for use when acknowledging
      setOrderProductIds(productIds);

      // Reset acknowledgments and re-apply hold
      const shop = getShopDomain();
      const resetUrl = `${BASE_URL}/api/public/reset-acknowledgments${shop ? `?shop=${encodeURIComponent(shop)}` : ''}`;

      try {
        const resetResponse = await fetch(resetUrl, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
          },
          body: JSON.stringify({
            orderId,
            productIds,
          }),
        });

        if (resetResponse.ok) {
          const resetData = await resetResponse.json();
          // Mark hold as secured once the API confirms it was applied
          if (resetData.holdApplied || resetData.success) {
            setHoldSecured(true);
          }
        } else {
          // Still mark as secured to show notes - the hold may already be in place
          setHoldSecured(true);
        }
      } catch (resetErr) {
        // Still mark as secured to allow viewing notes
        setHoldSecured(true);
      }

      // Now fetch notes (acknowledgments will be empty after reset)
      const url = `${BASE_URL}/api/public/orders/${encodeURIComponent(orderId)}/notes${shop ? `?shop=${encodeURIComponent(shop)}` : ''}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ productIds }),
      });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || 'Failed to fetch notes');
      }

      const responseData = await response.json();

      setProductNotes(responseData.notes || []);

      // Initialize acknowledgments as empty (since we just reset them)
      const acks: Record<string, any> = {};
      (responseData.notes || []).forEach((note: any) => {
        acks[note.id] = { acknowledged: false };
      });
      setAcknowledgments(acks);

    } catch (err: any) {
      console.error('[Order Extension] Error in resetAndFetchNotes:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleAcknowledge = async (noteId: string, photoRequired = false) => {
    // Mark as pending immediately for visual feedback
    setPendingAcknowledgments(prev => new Set(prev).add(noteId));

    if (photoRequired || settings?.requirePhotoProof) {
      setCurrentNoteId(noteId);
      setShowPhotoModal(true);
    } else {
      await submitAcknowledgment(noteId);
    }
  };
  
  const submitAcknowledgment = async (noteId: string, photoData: File | null = null) => {
    // Validate orderId exists before submitting
    if (!orderId) {
      setError("Cannot acknowledge: Order ID is missing");
      setPendingAcknowledgments(prev => {
        const next = new Set(prev);
        next.delete(noteId);
        return next;
      });
      return;
    }

    try {
      const formData = new FormData();
      formData.append('noteId', noteId);
      formData.append('orderId', orderId);
      // Pass all product IDs so API can check if all notes are acknowledged
      formData.append('allProductIds', JSON.stringify(orderProductIds));

      if (photoData) {
        formData.append('photo', photoData);
      }

      const shop = getShopDomain();
      const url = `${BASE_URL}/api/public/acknowledgments${shop ? `?shop=${encodeURIComponent(shop)}` : ''}`;

      const response = await fetch(url, {
        method: 'POST',
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to acknowledge note');

      const responseData = await response.json();

      // Update local state
      setAcknowledgments(prev => ({
        ...prev,
        [noteId]: {
          acknowledged: true,
          acknowledgedAt: new Date().toISOString(),
          proofPhotoUrl: photoData ? URL.createObjectURL(photoData) : null,
        },
      }));

      // Check if all notes are now acknowledged and hold was auto-released
      if (responseData.allAcknowledged) {
        setCanFulfill(true);

        // Check if hold was auto-released
        if (responseData.holdReleased) {
          setHoldReleased(true);
        }
      }

      setShowPhotoModal(false);
      setCurrentNoteId(null);

    } catch (err: any) {
      setError(err.message);
      // Remove from pending on error so user can retry
      setPendingAcknowledgments(prev => {
        const next = new Set(prev);
        next.delete(noteId);
        return next;
      });
    }
  };
  
  const handlePhotoUpload = async (event: any) => {
    const file = event.target.files[0];
    if (file && currentNoteId) {
      await submitAcknowledgment(currentNoteId, file);
    }
  };

  // Explicitly release the hold - user must click this button
  const releaseHoldAndFulfill = async () => {
    if (!orderId) {
      setError("Cannot release hold: Order ID is missing");
      return;
    }

    try {
      setReleasingHold(true);

      const shop = getShopDomain();
      const url = `${BASE_URL}/api/public/release-hold${shop ? `?shop=${encodeURIComponent(shop)}` : ''}`;

      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          orderId,
          productIds: orderProductIds,
        }),
      });

      const responseData = await response.json();

      if (response.ok && responseData.success) {
        setHoldReleased(true);
      } else {
        setError(responseData.error || 'Failed to release hold');
      }
    } catch (err: any) {
      setError(err.message);
    } finally {
      setReleasingHold(false);
    }
  };
  
  if (loading) {
    return (
      <Box padding="base">
        <BlockStack>
          <Banner tone="critical">
            <Text fontWeight="bold">PLEASE WAIT - Checking for product notes...</Text>
          </Banner>
          <Banner tone="warning">
            <Text>Do not create shipping labels or fulfill this order until this check completes.</Text>
          </Banner>
        </BlockStack>
      </Box>
    );
  }

  if (error) {
    return (
      <Box padding="base">
        <BlockStack>
          <Text fontWeight="bold">Product Notes</Text>
          <Banner tone="critical">
            <Text>Error: {error}</Text>
          </Banner>
          <Text emphasis="subdued">{debugInfo}</Text>
          <Button onPress={fetchOrderNotes}>Retry</Button>
        </BlockStack>
      </Box>
    );
  }

  if (productNotes.length === 0) {
    return (
      <Box padding="base">
        <BlockStack>
          <Text fontWeight="bold">Product Notes</Text>
          <Text emphasis="subdued">No notes for products in this order.</Text>
          <Text emphasis="subdued">{debugInfo}</Text>
        </BlockStack>
      </Box>
    );
  }
  
  return (
    <BlockStack>
      {/* Show critical warning if notes need acknowledgment */}
      {settings?.blockFulfillment && !canFulfill && (
        <Banner tone="critical">
          <BlockStack>
            <Text fontWeight="bold">ORDER ON HOLD - Products Have Important Notes</Text>
            <Text>This order contains products with staff notes that must be reviewed before shipping. Please read and acknowledge each note below to release the hold.</Text>
          </BlockStack>
        </Banner>
      )}

      {/* Show button to release hold when all acknowledged but hold not released */}
      {settings?.blockFulfillment && canFulfill && !holdReleased && productNotes.length > 0 && (
        <Box padding="base">
          <BlockStack>
            <Banner tone="success">
              <Text fontWeight="bold">All notes reviewed! Click the button below to release the hold and proceed with fulfillment.</Text>
            </Banner>
            <Button
              variant="primary"
              onPress={releaseHoldAndFulfill}
              disabled={releasingHold}
            >
              {releasingHold ? 'Releasing Hold...' : 'Release Hold & Proceed to Fulfillment'}
            </Button>
          </BlockStack>
        </Box>
      )}

      {/* Show success when hold is released */}
      {holdReleased && (
        <Banner tone="success">
          <Text fontWeight="bold">Ready to ship! The hold has been released and you can now fulfill this order.</Text>
        </Banner>
      )}
      
      <Box padding="base">
        <BlockStack>
          <Text>
            Product Notes for This Order
          </Text>
          
          <Text>
            Review and acknowledge these important notes before fulfilling the order.
          </Text>
          
          {productNotes.map((note) => {
            const ack = acknowledgments[note.id];
            const isAcknowledged = ack?.acknowledged;
            
            return (
              <Box key={note.id} padding="base">
                <BlockStack>
                  <InlineStack>
                    <Text>
                      Product: {note.productTitle || note.productId}
                    </Text>
                    {isAcknowledged && (
                      <Badge tone="success">
                        <Text>✓</Text>
                        Acknowledged
                      </Badge>
                    )}
                  </InlineStack>
                  
                  <Text>{note.content}</Text>

                  {note.photos && note.photos.length > 0 && (
                    <InlineStack blockAlignment="center" gap="tight">
                      <Link
                        href={note.photos[0].url.startsWith('/')
                          ? `${BASE_URL}${note.photos[0].url}`
                          : note.photos[0].url}
                        external
                      >
                        <Image
                          source={note.photos[0].thumbnailUrl
                            ? (note.photos[0].thumbnailUrl.startsWith('/')
                                ? `${BASE_URL}${note.photos[0].thumbnailUrl}`
                                : note.photos[0].thumbnailUrl)
                            : (note.photos[0].url.startsWith('/')
                                ? `${BASE_URL}${note.photos[0].url}`
                                : note.photos[0].url)}
                          alt="Product note photo"
                        />
                      </Link>
                      {note.photos.length > 1 && (
                        <Badge tone="info">+{note.photos.length - 1} more</Badge>
                      )}
                    </InlineStack>
                  )}
                  
                  {!isAcknowledged && settings?.requireAcknowledgment && (
                    <InlineStack>
                      <Checkbox
                        label={pendingAcknowledgments.has(note.id) ? "Saving acknowledgment..." : "I have read and understood this note"}
                        checked={pendingAcknowledgments.has(note.id)}
                        disabled={pendingAcknowledgments.has(note.id)}
                        onChange={(checked) => {
                          if (checked && !pendingAcknowledgments.has(note.id)) {
                            handleAcknowledge(note.id);
                          }
                        }}
                      />
                    </InlineStack>
                  )}
                  
                  {isAcknowledged && (
                    <Text>
                      Acknowledged by {ack.acknowledgedBy} at {new Date(ack.acknowledgedAt).toLocaleString()}
                    </Text>
                  )}
                  
                  {isAcknowledged && ack.proofPhotoUrl && (
                    <InlineStack blockAlignment="center" gap="tight">
                      <Text>Proof photo:</Text>
                      <Link
                        href={ack.proofPhotoUrl.startsWith('/')
                          ? `${BASE_URL}${ack.proofPhotoUrl}`
                          : ack.proofPhotoUrl}
                        external
                      >
                        <Image
                          source={ack.proofPhotoUrl.startsWith('/')
                            ? `${BASE_URL}${ack.proofPhotoUrl}`
                            : ack.proofPhotoUrl}
                          alt="Acknowledgment proof"
                        />
                      </Link>
                    </InlineStack>
                  )}
                </BlockStack>
              </Box>
            );
          })}
          
        </BlockStack>
      </Box>
      
      {/* Photo upload modal - Note: Native file input may have limited functionality
          in Shopify's extension sandbox. Test thoroughly before enabling photo proof feature.
          Consider using Shopify's admin APIs for file handling if issues occur. */}
      {showPhotoModal && (
        <Modal
          title="Upload Proof Photo"
          open={showPhotoModal}
          onClose={() => {
            setShowPhotoModal(false);
            setCurrentNoteId(null);
          }}
          primaryAction={{
            content: 'Cancel',
            onAction: () => {
              setShowPhotoModal(false);
              setCurrentNoteId(null);
            },
          }}
        >
          <Modal.Section>
            <BlockStack gap="base">
              <Text>
                Please upload a photo as proof of acknowledgment.
              </Text>

              <input
                type="file"
                accept="image/*"
                capture="environment"
                onChange={handlePhotoUpload}
                style={{
                  padding: '8px',
                  border: '1px solid #e1e3e5',
                  borderRadius: '4px',
                  width: '100%',
                }}
              />

              <Text appearance="subdued" variant="bodySm">
                This photo will be saved as part of the audit trail.
              </Text>
            </BlockStack>
          </Modal.Section>
        </Modal>
      )}
    </BlockStack>
  );
}