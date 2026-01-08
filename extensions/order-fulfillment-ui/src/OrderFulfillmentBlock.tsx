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
  useApi,
} from '@shopify/ui-extensions-react/admin';

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
  const [canFulfill, setCanFulfill] = useState(true);
  const [debugInfo, setDebugInfo] = useState<string>('');

  const orderId = data.selected?.[0]?.id;
  const BASE_URL = "https://shopify-internal-notes-app-production.up.railway.app";

  // Try to get shop domain from multiple sources
  const getShopDomain = (): string => {
    const possibleShop =
      (api as any).shop?.myshopifyDomain ||
      (api as any).data?.shop?.myshopifyDomain ||
      (api as any).extension?.shop ||
      (api as any).host?.shop ||
      '';
    console.log('[Order Extension] Shop domain found:', possibleShop);
    return possibleShop;
  };

  useEffect(() => {
    // Log API structure for debugging
    console.log('[Order Extension] Full API keys:', Object.keys(api));
    console.log('[Order Extension] Data:', JSON.stringify(data));
    console.log('[Order Extension] Order ID:', orderId);

    const shop = getShopDomain();
    setDebugInfo(`Order: ${orderId || 'none'}, Shop: ${shop || 'none'}`);

    if (orderId) {
      fetchOrderNotes();
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
      console.log('[Order Extension] Starting fetchOrderNotes for order:', orderId);

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

          console.log('[Order Extension] GraphQL result:', JSON.stringify(result));

          if (result?.data?.order?.lineItems?.edges) {
            productIds = result.data.order.lineItems.edges
              .map((edge: any) => edge.node?.product?.id)
              .filter(Boolean);
          }
        }
      } catch (queryErr) {
        console.log('[Order Extension] GraphQL query failed:', queryErr);
      }

      console.log('[Order Extension] Product IDs found:', productIds);

      if (productIds.length === 0) {
        console.log('[Order Extension] No product IDs found');
        setProductNotes([]);
        setLoading(false);
        return;
      }

      const shop = getShopDomain();
      const url = `${BASE_URL}/api/public/orders/${encodeURIComponent(orderId)}/notes${shop ? `?shop=${encodeURIComponent(shop)}` : ''}`;

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
  
  const handleAcknowledge = async (noteId: string, photoRequired = false) => {
    if (photoRequired || settings?.requirePhotoProof) {
      setCurrentNoteId(noteId);
      setShowPhotoModal(true);
    } else {
      await submitAcknowledgment(noteId);
    }
  };
  
  const submitAcknowledgment = async (noteId: string, photoData: File | null = null) => {
    try {
      const formData = new FormData();
      formData.append('noteId', noteId);
      formData.append('orderId', orderId);

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
      
      // Update local state
      setAcknowledgments(prev => ({
        ...prev,
        [noteId]: {
          acknowledged: true,
          acknowledgedAt: new Date().toISOString(),
          proofPhotoUrl: photoData ? URL.createObjectURL(photoData) : null,
        },
      }));
      
      setShowPhotoModal(false);
      setCurrentNoteId(null);
      
    } catch (err: any) {
      setError(err.message);
    }
  };
  
  const handlePhotoUpload = async (event: any) => {
    const file = event.target.files[0];
    if (file && currentNoteId) {
      await submitAcknowledgment(currentNoteId, file);
    }
  };
  
  if (loading) {
    return (
      <Box padding="base">
        <BlockStack>
          <Text fontWeight="bold">Internal Notes</Text>
          <Text>Loading product notes...</Text>
          <Text emphasis="subdued">{debugInfo}</Text>
        </BlockStack>
      </Box>
    );
  }

  if (error) {
    return (
      <Box padding="base">
        <BlockStack>
          <Text fontWeight="bold">Internal Notes</Text>
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
          <Text fontWeight="bold">Internal Notes</Text>
          <Text emphasis="subdued">No notes for products in this order.</Text>
          <Text emphasis="subdued">{debugInfo}</Text>
        </BlockStack>
      </Box>
    );
  }
  
  return (
    <BlockStack>
      {/* TEST: This should ALWAYS appear if new code is loaded */}
      <Banner tone="critical">
        <Text>VERSION TEST 123 - If you see this, new code is loaded!</Text>
      </Banner>

      {settings?.blockFulfillment && !canFulfill && (
        <Banner
          title="Acknowledgment Required"
          tone="warning"
        >
          <Text>
            All product notes must be acknowledged before fulfilling this order.
          </Text>
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

                  {/* Debug: Show photo count */}
                  <Text emphasis="subdued">Photos: {note.photos?.length || 0}</Text>

                  {/* PLACEHOLDER TEST - Always show this */}
                  <Banner tone="info">
                    <Text>PHOTO PLACEHOLDER - Has {note.photos?.length || 0} photos</Text>
                    {note.photos && note.photos.length > 0 && (
                      <Text>URL: {note.photos[0].url.substring(0, 50)}...</Text>
                    )}
                  </Banner>

                  {note.photos && note.photos.length > 0 && (
                    <InlineStack blockAlignment="center" gap="tight">
                      <Image
                        source={note.photos[0].url.startsWith('/')
                          ? `${BASE_URL}${note.photos[0].url}`
                          : note.photos[0].url}
                        alt="Product note photo"
                      />
                      {note.photos.length > 1 && (
                        <Badge tone="info">+{note.photos.length - 1} more</Badge>
                      )}
                    </InlineStack>
                  )}
                  
                  {!isAcknowledged && settings?.requireAcknowledgment && (
                    <InlineStack>
                      <Checkbox
                        label="I have read and understood this note"
                        checked={false}
                        onChange={(checked) => {
                          if (checked) {
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
                      <Image
                        source={ack.proofPhotoUrl.startsWith('/')
                          ? `${BASE_URL}${ack.proofPhotoUrl}`
                          : ack.proofPhotoUrl}
                        alt="Acknowledgment proof"
                      />
                    </InlineStack>
                  )}
                </BlockStack>
              </Box>
            );
          })}
          
          {settings?.requireAcknowledgment && !canFulfill && (
            <Banner tone="critical">
              <Text>
                Order fulfillment is blocked until all notes are acknowledged.
              </Text>
            </Banner>
          )}
        </BlockStack>
      </Box>
      
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