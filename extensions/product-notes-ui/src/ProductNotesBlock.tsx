import {
  reactExtension,
  BlockStack,
  Button,
  TextField,
  Text,
  InlineStack,
  Card,
  Icon,
  Badge,
  Modal,
  useApi,
  useState,
  useEffect,
} from '@shopify/ui-extensions-react/admin';

const TARGET = 'admin.product-details.block.render';

export default reactExtension(TARGET, () => <ProductNotesBlock />);

function ProductNotesBlock() {
  const { extension, i18n, data } = useApi(TARGET);
  const [notes, setNotes] = useState([]);
  const [newNote, setNewNote] = useState('');
  const [showModal, setShowModal] = useState(false);
  const [editingNote, setEditingNote] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  
  const productId = data.selected?.[0]?.id;
  
  useEffect(() => {
    if (productId) {
      fetchNotes();
    }
  }, [productId]);
  
  const fetchNotes = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/apps/internal-notes/api/products/${productId}/notes`, {
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': extension.sessionToken,
        },
      });
      
      if (!response.ok) throw new Error('Failed to fetch notes');
      
      const data = await response.json();
      setNotes(data.notes);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  };
  
  const handleSaveNote = async () => {
    if (!newNote.trim()) return;
    
    try {
      const response = await fetch(`/apps/internal-notes/api/products/${productId}/notes`, {
        method: editingNote ? 'PUT' : 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': extension.sessionToken,
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
      setShowModal(false);
    } catch (err) {
      setError(err.message);
    }
  };
  
  const handleDeleteNote = async (noteId) => {
    if (!confirm('Are you sure you want to delete this note?')) return;
    
    try {
      const response = await fetch(`/apps/internal-notes/api/products/${productId}/notes/${noteId}`, {
        method: 'DELETE',
        headers: {
          'Content-Type': 'application/json',
          'X-Shopify-Access-Token': extension.sessionToken,
        },
      });
      
      if (!response.ok) throw new Error('Failed to delete note');
      
      await fetchNotes();
    } catch (err) {
      setError(err.message);
    }
  };
  
  const handleEditNote = (note) => {
    setEditingNote(note);
    setNewNote(note.content);
    setShowModal(true);
  };
  
  const handleUploadPhoto = async (noteId, file) => {
    const formData = new FormData();
    formData.append('photo', file);
    
    try {
      const response = await fetch(`/apps/internal-notes/api/products/${productId}/notes/${noteId}/photos`, {
        method: 'POST',
        headers: {
          'X-Shopify-Access-Token': extension.sessionToken,
        },
        body: formData,
      });
      
      if (!response.ok) throw new Error('Failed to upload photo');
      
      await fetchNotes();
    } catch (err) {
      setError(err.message);
    }
  };
  
  if (loading) {
    return (
      <Card padding>
        <Text>Loading notes...</Text>
      </Card>
    );
  }
  
  if (error) {
    return (
      <Card padding>
        <Text appearance="critical">Error: {error}</Text>
      </Card>
    );
  }
  
  return (
    <BlockStack gap="loose">
      <Card padding>
        <BlockStack gap="base">
          <InlineStack align="spaceBetween">
            <Text variant="headingMd" as="h2">
              Internal Product Notes
            </Text>
            <Button
              variant="primary"
              size="slim"
              onPress={() => {
                setEditingNote(null);
                setNewNote('');
                setShowModal(true);
              }}
            >
              Add Note
            </Button>
          </InlineStack>
          
          <Text appearance="subdued">
            These notes are only visible to staff and never shown to customers.
          </Text>
          
          {notes.length === 0 ? (
            <Card padding="loose" subdued>
              <Text appearance="subdued">No notes yet. Add one to get started.</Text>
            </Card>
          ) : (
            <BlockStack gap="base">
              {notes.map((note) => (
                <Card key={note.id} padding>
                  <BlockStack gap="tight">
                    <InlineStack align="spaceBetween">
                      <Text variant="bodyMd">{note.content}</Text>
                      <InlineStack gap="tight">
                        <Button
                          variant="plain"
                          size="slim"
                          onPress={() => handleEditNote(note)}
                        >
                          Edit
                        </Button>
                        <Button
                          variant="plain"
                          size="slim"
                          tone="critical"
                          onPress={() => handleDeleteNote(note.id)}
                        >
                          Delete
                        </Button>
                      </InlineStack>
                    </InlineStack>
                    
                    <InlineStack gap="tight" align="start">
                      <Text appearance="subdued" variant="bodySm">
                        {note.updatedBy} • {new Date(note.updatedAt).toLocaleString()}
                      </Text>
                      {note.photos.length > 0 && (
                        <Badge tone="info">
                          {note.photos.length} photo{note.photos.length !== 1 ? 's' : ''}
                        </Badge>
                      )}
                    </InlineStack>
                    
                    {note.photos.length > 0 && (
                      <InlineStack gap="tight">
                        {note.photos.map((photo) => (
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
                      variant="plain"
                      size="slim"
                      onPress={() => {
                        const input = document.createElement('input');
                        input.type = 'file';
                        input.accept = 'image/*';
                        input.onchange = (e) => {
                          const file = e.target.files[0];
                          if (file) handleUploadPhoto(note.id, file);
                        };
                        input.click();
                      }}
                    >
                      <Icon source="ImageMajor" />
                      Add Photo
                    </Button>
                  </BlockStack>
                </Card>
              ))}
            </BlockStack>
          )}
        </BlockStack>
      </Card>
      
      {showModal && (
        <Modal
          title={editingNote ? 'Edit Note' : 'Add Note'}
          open={showModal}
          onClose={() => {
            setShowModal(false);
            setEditingNote(null);
            setNewNote('');
          }}
          primaryAction={{
            content: 'Save',
            onAction: handleSaveNote,
          }}
          secondaryActions={[
            {
              content: 'Cancel',
              onAction: () => {
                setShowModal(false);
                setEditingNote(null);
                setNewNote('');
              },
            },
          ]}
        >
          <Modal.Section>
            <TextField
              label="Note content"
              value={newNote}
              onChange={setNewNote}
              multiline={4}
              autoGrow
              helpText="This note will only be visible to staff members"
            />
          </Modal.Section>
        </Modal>
      )}
    </BlockStack>
  );
}