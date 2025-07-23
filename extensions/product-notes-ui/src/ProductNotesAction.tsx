import {
  reactExtension,
  useApi,
  AdminAction,
  BlockStack,
  Text,
} from '@shopify/ui-extensions-react/admin';

const TARGET = 'admin.product-details.action.render';

export default reactExtension(TARGET, () => <ProductNotesAction />);

function ProductNotesAction() {
  const { extension, i18n, data } = useApi(TARGET);
  const productId = data.selected?.[0]?.id;
  
  return (
    <AdminAction
      title="View Internal Notes"
      icon="NoteMajor"
      onAction={() => {
        // This will open the notes section or navigate to notes page
        window.location.href = `/admin/products/${productId}#internal-notes`;
      }}
    />
  );
}