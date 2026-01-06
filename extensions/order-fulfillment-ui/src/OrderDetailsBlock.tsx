import { useState, useEffect } from 'react';
import {
  reactExtension,
  BlockStack,
  Box,
  Text,
  Badge,
  InlineStack,
  useApi,
} from '@shopify/ui-extensions-react/admin';

const TARGET = 'admin.order-details.block.render';

export default reactExtension(TARGET, () => <OrderDetailsBlock />);

function OrderDetailsBlock() {
  const { data } = useApi<{ order?: { id: string } }>(TARGET);
  const [acknowledgments, setAcknowledgments] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);

  const orderId = data?.order?.id;
  
  useEffect(() => {
    if (orderId) {
      fetchAcknowledgments();
    }
  }, [orderId]);
  
  const fetchAcknowledgments = async () => {
    try {
      setLoading(true);
      const response = await fetch(`https://shopify-internal-notes-app-production.up.railway.app/api/orders/${orderId}/acknowledgments`, {
        headers: {
          'Content-Type': 'application/json',
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch acknowledgments');
      
      const data = await response.json();
      setAcknowledgments(data.acknowledgments);
    } catch (err) {
      console.error('Failed to fetch acknowledgments:', err);
    } finally {
      setLoading(false);
    }
  };
  
  if (loading || acknowledgments.length === 0) {
    return null;
  }
  
  return (
    <Box padding="base">
      <BlockStack gap="base">
        <Text>
          Product Note Acknowledgments
        </Text>
        
        <BlockStack>
          {acknowledgments.map((ack) => (
            <Box key={ack.id} padding>
              <InlineStack>
                <BlockStack>
                  <Text>
                    Product: {ack.productTitle || ack.productId}
                  </Text>
                  <Text>
                    Acknowledged by {ack.acknowledgedBy} • {new Date(ack.acknowledgedAt).toLocaleString()}
                  </Text>
                </BlockStack>
                <Badge tone="success">Acknowledged</Badge>
              </InlineStack>
              
              {ack.proofPhotoUrl && (
                <InlineStack>
                  <Text>Proof:</Text>
                  <img
                    src={ack.proofPhotoUrl}
                    alt="Proof"
                    style={{
                      width: '40px',
                      height: '40px',
                      objectFit: 'cover',
                      borderRadius: '4px',
                      marginTop: '8px',
                    }}
                  />
                </InlineStack>
              )}
            </Box>
          ))}
        </BlockStack>
      </BlockStack>
    </Box>
  );
}