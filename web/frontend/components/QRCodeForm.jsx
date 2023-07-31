import { useState, useCallback } from "react";
import {
  Banner,
  Card,
  Form,
  FormLayout,
  TextField,
  Button,
  ChoiceList,
  Thumbnail,
  Icon,
  Stack,
  TextStyle,
  Layout,
  EmptyState,
  Toast,
  Frame,
} from "@shopify/polaris";
import {
  ContextualSaveBar,
  ResourcePicker,
  useNavigate,
} from "@shopify/app-bridge-react";
import { ImageMajor, AlertMinor } from "@shopify/polaris-icons";

/* Import the useAuthenticatedFetch hook included in the Node app template */
import { useAuthenticatedFetch, useAppQuery } from "../hooks";
/* Import custom hooks for forms */
import { useForm, useField, notEmptyString } from "@shopify/react-form";
import { useParams } from "react-router-dom";

const NO_DISCOUNT_OPTION = { label: "No discount", value: "" };

export function QRCodeForm({ QRCode: InitialQRCode }) {
  const [QRCode, setQRCode] = useState(InitialQRCode);
  const [active, setActive] = useState(false);
  const [getToast, setToast] = useState(false);
  const [getname, setName] = useState(QRCode?.product.title);
  const [showResourcePicker, setShowResourcePicker] = useState(false);
  const [selectedProduct, setSelectedProduct] = useState(QRCode?.product);
  const navigate = useNavigate();
  const fetch = useAuthenticatedFetch();
  const deletedProduct = QRCode?.product?.title === "Deleted product";

  // toast message 
  const toggleActive = useCallback(() => setActive((active) => !active), []);

  const toastMarkup = active ? (
    <Toast content="deleted sucessfully" onDismiss={toggleActive} />
  ) : null;

  console.log("in  qrcode form data", QRCode);
  const onSubmit = useCallback(
    (body) => {
      (async () => {
        const parsedBody = body;
        // console.log("body in qr code", parsedBody.destination);
        parsedBody.destination = parsedBody.destination[0];
        const QRCodeId = QRCode?.id;
        /* construct the appropriate URL to send the API request to based on whether the QR code is new or being updated */
        const url = QRCodeId ? `/api/qrcodes/${QRCodeId}` : "/api/qrcodes";
        /* a condition to select the appropriate HTTP method: PATCH to update a QR code or POST to create a new QR code */
        const method = QRCodeId ? "PATCH" : "POST";
        /* use (authenticated) fetch from App Bridge to send the request to the API and, if successful, clear the form to reset the ContextualSaveBar and parse the response JSON */
        const response = await fetch(url, {
          method,
          body: JSON.stringify(parsedBody),
          headers: { "Content-Type": "application/json" },
        });
        console.log("response in form", response);
        if (response.ok) {
          makeClean();
          const QRCode = await response.json();
          /* if this is a new QR code, then save the QR code and navigate to the edit page; this behavior is the standard when saving resources in the Shopify admin */
          if (!QRCodeId) {
            // console.log("qrcodes");
            navigate(`/qrcodes/${QRCode.id}`);
            /* if this is a QR code update, update the QR code state in this component */
          } else {
            // console.log("send qr code");
            setQRCode(QRCode);
          }
        }
      })();
      return { status: "success" };
    },
    [QRCode, setQRCode]
  );

  const {
    fields: { title, productId, handle, destination,variantId },
    dirty,
    reset,
    submitting,
    submit,
    makeClean,
  } = useForm({
    fields: {
      title: useField({
        value: QRCode?.title || "",
        validates: [notEmptyString("Please name your QR code")],
      }),
      productId: useField({
        value: deletedProduct ? "Deleted product" : QRCode?.product?.id || "",
        validates: [notEmptyString("Please select a product")],
      }),
      variantId: useField(QRCode?.variantId || ""),
      handle: useField(QRCode?.handle || ""),
      destination: useField(
        QRCode?.destination ? [QRCode.destination] : ["product"]
      ),
    },
    onSubmit,
  });

  const QRCodeURL = QRCode
    ? new URL(`/qrcodes/${QRCode.id}/image`, location.toString()).toString()
    : null;

  console.log("qr code url", QRCodeURL);

  const handleProductChange = useCallback(({ selection }) => {
    setSelectedProduct({
      title: selection[0].title,
      images: selection[0].images,
      handle: selection[0].handle,
    });
    productId.onChange(selection[0].id);
    variantId.onChange(selection[0].variants[0].id);
    handle.onChange(selection[0].handle);
    setShowResourcePicker(false);
    // console.log("products", selection[0]);
  }, []);

  const toggleResourcePicker = useCallback(
    () => setShowResourcePicker(!showResourcePicker),
    [showResourcePicker]
  );

  const { id } = useParams();

  const isDeleting = false;
  const deleteQRCode = useCallback(async () => {
    // console.log("delete under async");
    const QRCodeId = id;

    const url = `/api/qrcodes/${QRCodeId}`;
    const method = "delete";
    const response = await fetch(url, {
      method,
      headers: { "Content-Type": "application/json" },
    });

  if (response.ok) {
    console.log("after deleted", response);
    navigate(`/`);
  }
}, [QRCode]);


  const {
    data: shopData,
    isLoading: isLoadingShopData,
    isError: shopDataError,
    /* useAppQuery makes a query to `/api/shop-data`, which the backend authenticates before fetching the data from the Shopify GraphQL Admin API */
  } = useAppQuery({ url: "/api/shop-data" });

  const goToDestination = useCallback(async () => {
    // console.log( "go to destination",  handle.value,"seleted product",selectedProduct.id );
    if (!selectedProduct) return;
    const data = {
      shopUrl: shopData?.shop.url,
      productHandle: handle.value || selectedProduct.handle,
      variantId: variantId.value,
    };
    // console.log("go to detination", data);
    const targetURL =
      deletedProduct || destination.value[0] === "product"
        ? await productViewURL(data)
        : await productCheckoutURL(data);
    console.log("target url", targetURL);

    window.open(targetURL, "_blank", "noreferrer,noopener");
  }, [QRCode, selectedProduct, destination, handle,variantId ,shopData]);

  const imageSrc = selectedProduct?.images?.edges?.[0]?.node?.url;
  const originalImageSrc = selectedProduct?.images?.[0]?.originalSrc;
  const altText =
    selectedProduct?.images?.[0]?.altText || selectedProduct?.title;

  /* The form layout, created using Polaris and App Bridge components. */
  return (
    <Frame>
      <Stack vertical>
        {deletedProduct && (
          <Banner
            title="The product for this QR code no longer exists."
            status="critical"
          >
            <p>
              Scans will be directed to a 404 page, or you can choose another
              product for this QR code.
            </p>
          </Banner>
        )}
        <Layout>
          <Layout.Section>
            <Form>
              <ContextualSaveBar
                saveAction={{
                  label: "Save",
                  onAction: submit,
                  loading: submitting,
                  disabled: submitting,
                }}
                discardAction={{
                  label: "Discard",
                  onAction: { reset },
                  loading: submitting,
                  disabled: submitting,
                }}
                visible={dirty}
                fullWidth
              />
              <FormLayout>
                <Card sectioned title="Title">
                  <TextField
                    {...title}
                    label="Title"
                    labelHidden
                    helpText="Only store staff can see this title"
                  />
                </Card>

                <Card
                  title="Product"
                  actions={[
                    {
                      content: productId.value
                        ? "Change product"
                        : "Select product",
                      onAction: toggleResourcePicker,
                    },
                  ]}
                >
                  <Card.Section>
                    {showResourcePicker && (
                      <ResourcePicker
                        resourceType="Product"
                        showVariants={false}
                        selectMultiple={false}
                        onCancel={toggleResourcePicker}
                        onSelection={handleProductChange}
                        open
                      />
                    )}
                    {productId.value ? (
                      <Stack alignment="center">
                        {imageSrc || originalImageSrc ? (
                          <Thumbnail
                            source={imageSrc || originalImageSrc}
                            alt={altText}
                          />
                        ) : (
                          <Thumbnail
                            source={ImageMajor}
                            color="base"
                            size="large"
                          />
                        )}
                        <TextStyle variation="strong">
                          {selectedProduct.title}
                        </TextStyle>
                      </Stack>
                    ) : (
                      <Stack vertical spacing="extraTight">
                        <Button onClick={toggleResourcePicker}>
                          Select product
                        </Button>
                        {productId.error && (
                          <Stack spacing="tight">
                            <Icon source={AlertMinor} color="critical" />
                            <TextStyle variation="negative">
                              {productId.error}
                            </TextStyle>
                          </Stack>
                        )}
                      </Stack>
                    )}
                  </Card.Section>
                  <Card.Section title="Scan Destination">
                    <ChoiceList
                      title="Scan destination"
                      titleHidden
                      choices={[
                        { label: "Link to product page", value: "product" },
                        {
                          label:
                            "Link to checkout page with product in the cart",
                          value: "checkout",
                        },
                      ]}
                      selected={destination.value}
                      onChange={destination.onChange}
                    />
                  </Card.Section>
                </Card>
              </FormLayout>
            </Form>
          </Layout.Section>
          <Layout.Section secondary>
            <Card sectioned title="QR code">
              {QRCode ? ( <EmptyState imageContained={true} image={QRCodeURL} />  ) : (
                <EmptyState>
                  <p>Your QR code will appear here after you save.</p>
                </EmptyState>
              )}
              <Stack vertical>
                <Button
                  fullWidth
                  primary
                  download
                  url={QRCodeURL}
                  disabled={!QRCode || isDeleting}
                >
                  Download
                </Button>
                <Button
                  fullWidth
                  onClick={goToDestination}
                  disabled={!selectedProduct || isLoadingShopData}
                >
                  Go to destination
                </Button>
              </Stack>
            </Card>
          </Layout.Section>
          <Layout.Section>
            <p>{toastMarkup}</p>
          </Layout.Section>
          <Layout.Section>
            {QRCode?.id && (
              <Button
                outline
                destructive
                onClick={deleteQRCode}
                loading={isDeleting}
              >
                Delete QR code
              </Button>
            )}
          </Layout.Section>
        </Layout>
      </Stack>
    </Frame>
  );
}

/* Builds a URL to the selected product */
// const url = new URL(qrcode.shopDomain);

async function productViewURL({ shopUrl, productHandle }) {
  const url = new URL(shopUrl);
  const productPath = `/products/${await productHandle}`;
  /*
    If a discount is selected, then build a URL to the selected discount that redirects to the selected product: /discount/{code}?redirect=/products/{product}
  */
  url.pathname = productPath;
  console.log("form", url);

  return url.toString();
}

/* Builds a URL to a checkout that contains the selected product */
async function productCheckoutURL({ shopUrl, variantId, quantity = 1 }) {
  
  const url = new URL(shopUrl);
  let ids = variantId.replace(/gid:\/\/shopify\/ProductVariant\/([0-9]+)/, "$1");
  console.log("in checkout page", shopUrl, "id", variantId,"replace",ids);

  url.pathname = `/cart/${ids}:${quantity}`;

  /* Builds a URL to a checkout that contains the selected product with a discount code applied */
  return url.toString();
}
