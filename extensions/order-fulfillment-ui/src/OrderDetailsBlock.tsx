import {
  reactExtension,
  BlockStack,
  Card,
  Text,
  Badge,
  InlineStack,
  useApi,
  useState,
  useEffect,
} from '@shopify/ui-extensions-react/admin';

const TARGET = 'admin.order-details.block.render';

export default reactExtension(TARGET, () => <OrderDetailsBlock />);

function OrderDetailsBlock() {
  const { extension, data } = useApi(TARGET);
  const [acknowledgments, setAcknowledgments] = useState([]);
  const [loading, setLoading] = useState(true);
  
  const orderId = data.order?.id;
  
  useEffect(() => {
    if (orderId) {
      fetchAcknowledgments();
    }
  }, [orderId]);
  
  const fetchAcknowledgments = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/apps/internal-notes/api/orders/${orderId}/acknowledgments`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': extension.sessionToken,
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
    <Card padding>
      <BlockStack gap="base">
        <Text variant="headingMd" as="h2">
          Product Note Acknowledgments
        </Text>
        
        <BlockStack gap="tight">
          {acknowledgments.map((ack) => (
            <Card key={ack.id} padding="tight" subdued>
              <InlineStack align="spaceBetween">
                <BlockStack gap="extraTight">
                  <Text variant="bodyMd">
                    Product: {ack.productTitle || ack.productId}
                  </Text>
                  <Text appearance="subdued" variant="bodySm">
                    Acknowledged by {ack.acknowledgedBy} • {new Date(ack.acknowledgedAt).toLocaleString()}
                  </Text>
                </BlockStack>
                <Badge tone="success">Acknowledged</Badge>
              </InlineStack>
              
              {ack.proofPhotoUrl && (
                <InlineStack gap="tight" blockAlign="center">
                  <Text variant="bodySm">Proof:</Text>
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
            </Card>
          ))}
        </BlockStack>
      </BlockStack>
    </Card>
  );
}