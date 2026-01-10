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
  Image,
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
  const [currentNoteIndex, setCurrentNoteIndex] = useState(0);

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

      {/* No notes - show inline add form */}
      {notes.length === 0 && (
        <BlockStack gap="tight">
          <Text emphasis="subdued">No notes yet.</Text>
          {showForm ? (
            <BlockStack gap="tight">
              <TextField
                label="New note"
                value={newNote}
                onChange={setNewNote}
                onInput={setNewNote}
              />
              {newNote.length > 211 ? (
                <Banner tone="critical">
                  <Text>{newNote.length - 211} characters over limit</Text>
                </Banner>
              ) : (
                <Text emphasis="subdued">
                  {211 - newNote.length} characters remaining
                </Text>
              )}
              <InlineStack gap="tight">
                <Button variant="primary" onPress={handleSaveNote} disabled={newNote.length > 211 || !newNote.trim()}>
                  Save
                </Button>
                <Button onPress={() => {
                  setShowForm(false);
                  setNewNote('');
                }}>
                  Cancel
                </Button>
              </InlineStack>
            </BlockStack>
          ) : null}
        </BlockStack>
      )}

      {/* Add new note form (replaces note view) */}
      {notes.length > 0 && showForm && !editingNote && (
        <BlockStack gap="extraTight">
          <InlineStack blockAlignment="center">
            <Text fontWeight="bold">New Note</Text>
          </InlineStack>

          <Banner tone="info">
            <BlockStack gap="tight">
              <TextField
                label="New note"
                value={newNote}
                onChange={setNewNote}
                onInput={setNewNote}
              />
              {newNote.length > 211 ? (
                <Banner tone="critical">
                  <Text>{newNote.length - 211} characters over limit</Text>
                </Banner>
              ) : (
                <Text emphasis="subdued">
                  {211 - newNote.length} characters remaining
                </Text>
              )}
              <InlineStack gap="tight">
                <Button variant="primary" onPress={handleSaveNote} disabled={newNote.length > 211 || !newNote.trim()}>
                  Save
                </Button>
                <Button onPress={() => {
                  setShowForm(false);
                  setNewNote('');
                }}>
                  Cancel
                </Button>
              </InlineStack>
            </BlockStack>
          </Banner>
        </BlockStack>
      )}

      {/* Notes display with inline editing (hidden when adding) */}
      {notes.length > 0 && !(showForm && !editingNote) && (
        <BlockStack gap="extraTight">
          <InlineStack blockAlignment="center">
            <Text fontWeight="bold">Note</Text>
            <Badge tone="info">{currentNoteIndex + 1} / {notes.length}</Badge>
          </InlineStack>

          <Banner tone="info">
            <BlockStack gap="tight">
              {/* Note content - editable when editing this note */}
              {editingNote?.id === notes[currentNoteIndex].id ? (
                <BlockStack gap="tight">
                  <TextField
                    label="Edit note"
                    value={newNote}
                    onChange={setNewNote}
                    onInput={setNewNote}
                  />
                  {newNote.length > 211 ? (
                    <Banner tone="critical">
                      <Text>{newNote.length - 211} characters over limit</Text>
                    </Banner>
                  ) : (
                    <Text emphasis="subdued">
                      {211 - newNote.length} characters remaining
                    </Text>
                  )}
                  <InlineStack gap="tight">
                    <Button variant="primary" onPress={handleSaveNote} disabled={newNote.length > 211 || !newNote.trim()}>
                      Save
                    </Button>
                    <Button onPress={() => {
                      setEditingNote(null);
                      setNewNote('');
                    }}>
                      Cancel
                    </Button>
                  </InlineStack>
                </BlockStack>
              ) : (
                <Text>
                  {notes[currentNoteIndex].content.length > 211
                    ? notes[currentNoteIndex].content.substring(0, 211) + '...'
                    : notes[currentNoteIndex].content}
                </Text>
              )}

              {/* Photo thumbnail below (only when not editing) */}
              {editingNote?.id !== notes[currentNoteIndex].id && notes[currentNoteIndex].photos && notes[currentNoteIndex].photos.length > 0 && (
                <InlineStack gap="tight" blockAlignment="center">
                  <Link href={notes[currentNoteIndex].photos[0].url} external>
                    <Image
                      source={notes[currentNoteIndex].photos[0].thumbnailUrl || notes[currentNoteIndex].photos[0].url}
                      alt="Note photo"
                    />
                  </Link>
                  {notes[currentNoteIndex].photos.length > 1 && (
                    <Badge tone="info">+{notes[currentNoteIndex].photos.length - 1} more</Badge>
                  )}
                </InlineStack>
              )}

              {/* Edit/Delete and Manage Photos (only when not editing) */}
              {editingNote?.id !== notes[currentNoteIndex].id && (
                <InlineStack gap="tight" blockAlignment="center">
                  <Button variant="tertiary" onPress={() => handleEditNote(notes[currentNoteIndex])}>
                    Edit
                  </Button>
                  <Button variant="tertiary" tone="critical" onPress={() => {
                    handleDeleteNote(notes[currentNoteIndex].id);
                    if (currentNoteIndex > 0) setCurrentNoteIndex(currentNoteIndex - 1);
                  }}>
                    Delete
                  </Button>
                  <Link href={`https://${shopDomain}/admin/apps/internal-notes-for-listings/app/photo-manager/${notes[currentNoteIndex].id}`} target="_blank">
                    {notes[currentNoteIndex].photos && notes[currentNoteIndex].photos.length > 0 ? 'Edit Image' : 'Attach Image'}
                  </Link>
                </InlineStack>
              )}
            </BlockStack>
          </Banner>

          {/* Navigation buttons (only when not editing) */}
          {notes.length > 1 && editingNote?.id !== notes[currentNoteIndex].id && (
            <InlineStack inlineAlignment="center">
              <Button
                variant="tertiary"
                disabled={currentNoteIndex === 0}
                onPress={() => setCurrentNoteIndex(currentNoteIndex - 1)}
              >
                Previous
              </Button>
              <Button
                variant="tertiary"
                disabled={currentNoteIndex === notes.length - 1}
                onPress={() => setCurrentNoteIndex(currentNoteIndex + 1)}
              >
                Next
              </Button>
            </InlineStack>
          )}
        </BlockStack>
      )}
    </BlockStack>
  );
}

// CodeRabbit review trigger - safe to remove
