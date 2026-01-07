import { useState, useEffect } from 'react';
import {
  reactExtension,
  BlockStack,
  Button,
  TextField,
  Text,
  InlineStack,
  Box,
  Badge,
  Banner,
  useApi,
  Link,
} from '@shopify/ui-extensions-react/admin';

const TARGET = 'admin.product-details.block.render';

export default reactExtension(TARGET, () => <ProductNotesBlock />);

function ProductNotesBlock() {
  const api = useApi(TARGET);
  const [notes, setNotes] = useState<any[]>([]);
  const [newNote, setNewNote] = useState('');
  const [showForm, setShowForm] = useState(false);
  const [editingNote, setEditingNote] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [shopDomain, setShopDomain] = useState<string>('');

  const productId = api.data.selected?.[0]?.id;
  const BASE_URL = "https://shopify-internal-notes-app-production.up.railway.app";

  // Fetch shop domain using Direct API Access
  const fetchShopDomain = async (): Promise<string> => {
    if (shopDomain) return shopDomain;

    // Try static properties first
    const staticShop =
      (api as any).shop?.myshopifyDomain ||
      (api as any).data?.shop?.myshopifyDomain ||
      (api as any).extension?.shop ||
      (api as any).host?.shop ||
      '';

    if (staticShop) {
      setShopDomain(staticShop);
      return staticShop;
    }

    // Use Direct API Access
    try {
      const response = await fetch('shopify:admin/api/graphql.json', {
        method: 'POST',
        body: JSON.stringify({
          query: `query GetShop { shop { myshopifyDomain } }`
        }),
      });
      const result = await response.json();
      if (result?.data?.shop?.myshopifyDomain) {
        const domain = result.data.shop.myshopifyDomain;
        setShopDomain(domain);
        return domain;
      }
    } catch (err) {
      console.error('[Extension] Shop GraphQL failed:', err);
    }

    return '';
  };

  // Helper to get session token
  const getSessionToken = async (): Promise<string | null> => {
    const attempts = [
      () => (api as any).sessionToken?.get?.(),
      () => (api as any).extension?.sessionToken?.get?.(),
      () => (api as any).getSessionToken?.(),
    ];

    for (const attempt of attempts) {
      try {
        const token = await attempt();
        if (token) return token;
      } catch (e) {
        // Try next method
      }
    }
    return null;
  };

  useEffect(() => {
    const init = async () => {
      const shop = await fetchShopDomain();
      if (productId && shop) {
        fetchNotes();
      }
    };
    init();
  }, [productId]);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await getSessionToken();
      const shop = shopDomain || await fetchShopDomain();

      const url = `${BASE_URL}/api/public/products/${encodeURIComponent(productId)}/notes${shop ? `?shop=${encodeURIComponent(shop)}` : ''}`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url, { headers });

      if (!response.ok) {
        const errorData = await response.json().catch(() => ({}));
        throw new Error(errorData.error || `HTTP ${response.status}`);
      }

      const data = await response.json();
      setNotes(data.notes || []);
    } catch (err: any) {
      console.error('[Extension] Fetch error:', err);
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveNote = async () => {
    if (!newNote.trim()) return;

    try {
      const token = await getSessionToken();
      const shop = shopDomain || await fetchShopDomain();
      const url = `${BASE_URL}/api/public/products/${encodeURIComponent(productId)}/notes${shop ? `?shop=${encodeURIComponent(shop)}` : ''}`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        method: editingNote ? 'PUT' : 'POST',
        headers,
        body: JSON.stringify({
          content: newNote,
          noteId: editingNote?.id,
        }),
      });

      if (!response.ok) throw new Error('Failed to save note');

      await fetchNotes();
      setNewNote('');
      setEditingNote(null);
      setShowForm(false);
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleDeleteNote = async (noteId: string) => {
    try {
      const token = await getSessionToken();
      const shop = shopDomain || await fetchShopDomain();
      const url = `${BASE_URL}/api/public/products/${encodeURIComponent(productId)}/notes/${encodeURIComponent(noteId)}${shop ? `?shop=${encodeURIComponent(shop)}` : ''}`;

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
      };
      if (token) {
        headers['Authorization'] = `Bearer ${token}`;
      }

      const response = await fetch(url, {
        method: 'DELETE',
        headers,
      });

      if (!response.ok) throw new Error('Failed to delete note');

      await fetchNotes();
    } catch (err: any) {
      setError(err.message);
    }
  };

  const handleEditNote = (note: any) => {
    setEditingNote(note);
    setNewNote(note.content);
    setShowForm(true);
  };

  // Extract numeric product ID for the app link
  const getNumericProductId = () => {
    if (!productId) return '';
    // productId is like "gid://shopify/Product/123456"
    const match = productId.match(/\/(\d+)$/);
    return match ? match[1] : productId;
  };

  if (loading) {
    return (
      <Box padding="base">
        <Text>Loading notes...</Text>
      </Box>
    );
  }

  if (error) {
    return (
      <Box padding="base">
        <BlockStack>
          <Banner tone="critical">
            <Text>Error: {error}</Text>
          </Banner>
          <Button onPress={fetchNotes}>Retry</Button>
        </BlockStack>
      </Box>
    );
  }

  return (
    <BlockStack gap="tight">
      {/* Header */}
      <InlineStack gap="base" blockAlignment="center">
        <Text fontWeight="bold">Internal Notes</Text>
        <Button
          variant="primary"
          onPress={() => {
            setEditingNote(null);
            setNewNote('');
            setShowForm(true);
          }}
        >
          Add
        </Button>
      </InlineStack>

      {/* Notes list */}
      {notes.length === 0 ? (
        <Text emphasis="subdued">No notes yet.</Text>
      ) : (
        <BlockStack gap="base">
          {notes.map((note) => (
            <Box key={note.id} padding="tight" border="base" borderRadius="base">
              <BlockStack gap="tight">
                <InlineStack gap="tight" blockAlignment="center">
                  <Box minInlineSize="fill">
                    <Text>{note.content}</Text>
                  </Box>
                  <Button variant="tertiary" onPress={() => handleEditNote(note)}>
                    Edit
                  </Button>
                  <Button variant="tertiary" tone="critical" onPress={() => handleDeleteNote(note.id)}>
                    ✕
                  </Button>
                </InlineStack>

                {/* Photo count and link to manage */}
                <InlineStack gap="tight" blockAlignment="center">
                  <Badge tone={note.photos?.length > 0 ? "success" : "info"}>
                    {note.photos?.length || 0} photo{note.photos?.length !== 1 ? 's' : ''}
                  </Badge>
                  <Link href={`https://${shopDomain}/admin/apps/internal-notes-for-listings/app/notes/${note.id}/photos`} target="_blank">
                    Manage Photos
                  </Link>
                </InlineStack>
              </BlockStack>
            </Box>
          ))}
        </BlockStack>
      )}

      {/* Add/Edit form */}
      {showForm && (
        <Box padding="tight" border="base" borderRadius="base">
          <BlockStack gap="tight">
            <TextField
              label={editingNote ? 'Edit note' : 'New note'}
              value={newNote}
              onChange={setNewNote}
            />

            <InlineStack gap="tight">
              <Button variant="primary" onPress={handleSaveNote}>
                Save
              </Button>
              <Button onPress={() => {
                setShowForm(false);
                setEditingNote(null);
                setNewNote('');
              }}>
                Cancel
              </Button>
            </InlineStack>

            {!editingNote && (
              <Text emphasis="subdued">
                After saving, click "Manage Photos" to add images.
              </Text>
            )}
          </BlockStack>
        </Box>
      )}
    </BlockStack>
  );
}
