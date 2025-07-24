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
  useApi,
} from '@shopify/ui-extensions-react/admin';

const TARGET = 'admin.order-details.action.render';

export default reactExtension(TARGET, () => <OrderFulfillmentBlock />);

function OrderFulfillmentBlock() {
  const { extension, data } = useApi(TARGET);
  const [productNotes, setProductNotes] = useState<any[]>([]);
  const [acknowledgments, setAcknowledgments] = useState<Record<string, any>>({});
  const [settings, setSettings] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [showPhotoModal, setShowPhotoModal] = useState(false);
  const [currentNoteId, setCurrentNoteId] = useState<string | null>(null);
  const [canFulfill, setCanFulfill] = useState(true);
  
  const orderId = data.order?.id;
  const lineItems = data.order?.lineItems || [];
  
  useEffect(() => {
    if (orderId) {
      fetchOrderNotes();
      fetchSettings();
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
      
      // Get product IDs from line items
      const productIds = lineItems.map((item: any) => item.product?.id).filter(Boolean);
      
      if (productIds.length === 0) {
        setProductNotes([]);
        setLoading(false);
        return;
      }
      
      const response = await fetch(`https://tract-hospitals-golden-crop.trycloudflare.com/api/orders/${orderId}/notes`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': extension.sessionToken,
        },
        body: JSON.stringify({ productIds }),
      });
      
      if (!response.ok) throw new Error('Failed to fetch notes');
      
      const data = await response.json();
      setProductNotes(data.notes);
      
      // Initialize acknowledgments state
      const acks = {};
      data.notes.forEach((note: any) => {
        acks[note.id] = data.acknowledgments.find((ack: any) => 
          ack.noteId === note.id && ack.orderId === orderId
        ) || { acknowledged: false };
      });
      setAcknowledgments(acks);
      
    } catch (err: any) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const fetchSettings = async () => {
    try {
      const response = await fetch('https://tract-hospitals-golden-crop.trycloudflare.com/api/settings', {
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': extension.sessionToken,
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch settings');
      
      const data = await response.json();
      setSettings(data.settings);
    } catch (err: any) {
      console.error('Failed to fetch settings:', err);
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
      
      const response = await fetch('https://tract-hospitals-golden-crop.trycloudflare.com/api/acknowledgments', {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': extension.sessionToken,
        },
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
        <Text>Loading product notes...</Text>
      </Box>
    );
  }
  
  if (productNotes.length === 0) {
    return null; // Don't show anything if no notes
  }
  
  return (
    <BlockStack>
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
                  
                  {note.photos.length > 0 && (
                    <InlineStack>
                      {note.photos.map((photo) => (
                        <img
                          key={photo.id}
                          src={photo.url}
                          alt="Product note"
                          style={{
                            width: '100px',
                            height: '100px',
                            objectFit: 'cover',
                            borderRadius: '4px',
                            border: '1px solid #e1e3e5',
                          }}
                        />
                      ))}
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
                    <InlineStack>
                      <Text>Proof photo:</Text>
                      <img
                        src={ack.proofPhotoUrl}
                        alt="Acknowledgment proof"
                        style={{
                          width: '80px',
                          height: '80px',
                          objectFit: 'cover',
                          borderRadius: '4px',
                          border: '1px solid #e1e3e5',
                        }}
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