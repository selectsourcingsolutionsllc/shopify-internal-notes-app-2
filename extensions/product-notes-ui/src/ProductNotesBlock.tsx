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
  const [debugInfo, setDebugInfo] = useState<string>('');

  const productId = api.data.selected?.[0]?.id;
  const BASE_URL = "https://shopify-internal-notes-app-production.up.railway.app";

  // Try multiple ways to get shop domain
  const getShopDomain = (): string => {
    // Try different API properties
    const possibleShop =
      (api as any).shop?.myshopifyDomain ||
      (api as any).data?.shop?.myshopifyDomain ||
      (api as any).extension?.shop ||
      (api as any).host?.shop ||
      '';

    // Log what we found for debugging
    console.log('[Extension] API object keys:', Object.keys(api));
    console.log('[Extension] Shop domain found:', possibleShop);

    return possibleShop;
  };

  // Helper to get session token (try multiple approaches)
  const getSessionToken = async (): Promise<string | null> => {
    // Try different ways to get the token
    const attempts = [
      () => (api as any).sessionToken?.get?.(),
      () => (api as any).extension?.sessionToken?.get?.(),
      () => (api as any).getSessionToken?.(),
    ];

    for (const attempt of attempts) {
      try {
        const token = await attempt();
        if (token) {
          console.log('[Extension] Got session token');
          return token;
        }
      } catch (e) {
        // Try next method
      }
    }

    console.log('[Extension] Could not get session token, continuing without auth');
    return null;
  };

  useEffect(() => {
    // Log API structure for debugging
    console.log('[Extension] Full API:', JSON.stringify(Object.keys(api)));
    setDebugInfo(`Product: ${productId}, Shop: ${getShopDomain()}`);

    if (productId) {
      fetchNotes();
    }
  }, [productId]);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await getSessionToken();
      const shop = getShopDomain();

      // Include shop as query param as fallback
      const url = `${BASE_URL}/api/public/products/${encodeURIComponent(productId)}/notes${shop ? `?shop=${encodeURIComponent(shop)}` : ''}`;
      console.log('[Extension] Fetching:', url);

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
      const shop = getShopDomain();
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
      const shop = getShopDomain();
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
          <Text emphasis="subdued">{debugInfo}</Text>
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

      {/* Notes list - compact */}
      {notes.length === 0 ? (
        <Text emphasis="subdued">No notes yet.</Text>
      ) : (
        <BlockStack gap="extraTight">
          {notes.map((note) => (
            <InlineStack key={note.id} gap="tight" blockAlignment="center">
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
          ))}
        </BlockStack>
      )}

      {/* Add/Edit form */}
      {showForm && (
        <BlockStack gap="tight">
          <TextField
            label={editingNote ? 'Edit note' : 'New note'}
            value={newNote}
            onChange={setNewNote}
          />
          <InlineStack gap="tight">
            <Button variant="primary" onPress={handleSaveNote}>Save</Button>
            <Button onPress={() => {
              setShowForm(false);
              setEditingNote(null);
              setNewNote('');
            }}>
              Cancel
            </Button>
          </InlineStack>
        </BlockStack>
      )}
    </BlockStack>
  );
}
