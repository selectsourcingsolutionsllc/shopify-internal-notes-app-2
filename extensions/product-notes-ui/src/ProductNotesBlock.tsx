import { useState, useEffect } from 'react';
import {
  reactExtension,
  BlockStack,
  Button,
  TextField,
  Text,
  InlineStack,
  Box,
  Icon,
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

  const productId = api.data.selected?.[0]?.id;

  const BASE_URL = "https://shopify-internal-notes-app-production.up.railway.app";

  // Helper to get session token
  const getSessionToken = async () => {
    try {
      const token = await (api as any).sessionToken.get();
      return token;
    } catch (e) {
      console.error('[Extension] Failed to get session token:', e);
      return null;
    }
  };

  useEffect(() => {
    if (productId) {
      fetchNotes();
    }
  }, [productId]);

  const fetchNotes = async () => {
    try {
      setLoading(true);
      setError(null);

      const token = await getSessionToken();
      const url = `${BASE_URL}/api/public/products/${encodeURIComponent(productId)}/notes`;
      console.log('[Extension] Fetching notes from:', url, 'with token:', token ? 'present' : 'missing');

      const response = await fetch(url, {
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
      });

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
      const url = `${BASE_URL}/api/public/products/${encodeURIComponent(productId)}/notes`;
      const response = await fetch(url, {
        method: editingNote ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
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
    if (!confirm('Are you sure you want to delete this note?')) return;

    try {
      const token = await getSessionToken();
      const url = `${BASE_URL}/api/public/products/${encodeURIComponent(productId)}/notes/${encodeURIComponent(noteId)}`;
      const response = await fetch(url, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': token ? `Bearer ${token}` : '',
        },
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

  const handleUploadPhoto = async (noteId: string, file: File) => {
    const formData = new FormData();
    formData.append('photo', file);

    try {
      const token = await getSessionToken();
      const url = `${BASE_URL}/api/public/products/${encodeURIComponent(productId)}/notes/${encodeURIComponent(noteId)}/photos`;
      const response = await fetch(url, {
        method: 'POST',
        headers: {
          'Authorization': token ? `Bearer ${token}` : '',
        },
        body: formData,
      });

      if (!response.ok) throw new Error('Failed to upload photo');

      await fetchNotes();
    } catch (err: any) {
      setError(err.message);
    }
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
        <Banner tone="critical">
          <Text>Error: {error}</Text>
        </Banner>
      </Box>
    );
  }
  
  return (
    <BlockStack>
      <Box padding="base">
        <BlockStack>
          <InlineStack>
            <Text>
              Internal Product Notes
            </Text>
            <Button
              variant="primary"
              onPress={() => {
                setEditingNote(null);
                setNewNote('');
                setShowForm(true);
              }}
            >
              Add Note
            </Button>
          </InlineStack>
          
          <Text>
            These notes are only visible to staff and never shown to customers.
          </Text>
          
          {notes.length === 0 ? (
            <Box padding="base">
              <Text>No notes yet. Add one to get started.</Text>
            </Box>
          ) : (
            <BlockStack>
              {notes.map((note) => (
                <Box key={note.id} padding="base">
                  <BlockStack>
                    <InlineStack>
                      <Text>{note.content}</Text>
                      <InlineStack>
                        <Button
                          variant="tertiary"
                          onPress={() => handleEditNote(note)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="tertiary"
                          tone="critical"
                          onPress={() => handleDeleteNote(note.id)}
                        >
                          Delete
                        </Button>
                      </InlineStack>
                    </InlineStack>
                    
                    <InlineStack>
                      <Text>
                        {note.updatedBy} • {new Date(note.updatedAt).toLocaleString()}
                      </Text>
                      {note.photos.length > 0 && (
                        <Badge tone="info">
                          {note.photos.length} photo{note.photos.length !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </InlineStack>
                    
                    {note.photos.length > 0 && (
                      <InlineStack>
                        {note.photos.map((photo: any) => (
                          <img
                            key={photo.id}
                            src={photo.url}
                            alt="Note attachment"
                            style={{
                              width: '80px',
                              height: '80px',
                              objectFit: 'cover',
                              borderRadius: '4px',
                            }}
                          />
                        ))}
                      </InlineStack>
                    )}
                    
                    <Button
                      variant="tertiary"
                      onPress={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = (e: any) => {
                          const file = e.target?.files?.[0];
                          if (file) handleUploadPhoto(note.id, file);
                        };
                        input.click();
                      }}
                    >
                      <Text>📷</Text>
                      Add Photo
                    </Button>
                  </BlockStack>
                </Box>
              ))}
            </BlockStack>
          )}
        </BlockStack>
      </Box>
      
      {showForm && (
        <Box padding="base">
          <BlockStack>
            <Text>{editingNote ? 'Edit Note' : 'Add Note'}</Text>
            <TextField
              label="Note content"
              value={newNote}
              onChange={setNewNote}
            />
            <InlineStack>
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
          </BlockStack>
        </Box>
      )}
    </BlockStack>
  );
}