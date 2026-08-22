export const LIST_PRODUCTS_QUERY = `#graphql
query ListProducts($first: Int!, $after: String, $query: String) {
  products(first: $first, after: $after, query: $query) {
    edges {
      cursor
      node {
        id
        title
        handle
        status
        vendor
        productType
        tags
        totalInventory
        createdAt
        updatedAt
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
`;

export const GET_PRODUCT_QUERY = `#graphql
query GetProduct($id: ID!) {
  product(id: $id) {
    id
    title
    handle
    descriptionHtml
    status
    vendor
    productType
    tags
    totalInventory
    options {
      id
      name
      values
    }
    variants(first: 50) {
      edges {
        node {
          id
          title
          sku
          price
          inventoryQuantity
        }
      }
    }
    media(first: 20) {
      edges {
        node {
          id
          mediaContentType
          preview {
            image {
              url
              altText
            }
          }
        }
      }
    }
    seo {
      title
      description
    }
  }
}
`;

export const CREATE_PRODUCT_MUTATION = `#graphql
mutation CreateProduct($product: ProductCreateInput!) {
  productCreate(product: $product) {
    product {
      id
      title
      handle
      status
    }
    userErrors {
      field
      message
    }
  }
}
`;

export const UPDATE_PRODUCT_MUTATION = `#graphql
mutation UpdateProduct($product: ProductUpdateInput!) {
  productUpdate(product: $product) {
    product {
      id
      title
      handle
      status
    }
    userErrors {
      field
      message
    }
  }
}
`;

export const LIST_COLLECTIONS_QUERY = `#graphql
query ListCollections($first: Int!, $after: String, $query: String) {
  collections(first: $first, after: $after, query: $query) {
    edges {
      cursor
      node {
        id
        title
        handle
        descriptionHtml
        updatedAt
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
`;

export const UPDATE_COLLECTION_MUTATION = `#graphql
mutation CollectionUpdate($collection: CollectionUpdateInput!) {
  collectionUpdate(collection: $collection) {
    collection {
      id
      title
      handle
      descriptionHtml
      updatedAt
    }
    job {
      id
      done
    }
    userErrors {
      field
      message
    }
  }
}
`;

export const LIST_THEMES_QUERY = `#graphql
query ListThemes($first: Int!, $after: String) {
  themes(first: $first, after: $after) {
    edges {
      cursor
      node {
        id
        name
        role
        createdAt
        updatedAt
        processing
      }
    }
    pageInfo {
      hasNextPage
      endCursor
    }
  }
}
`;

export const GET_THEME_FILES_QUERY = `#graphql
query GetThemeFiles($themeId: ID!, $filenames: [String!], $first: Int!, $after: String) {
  theme(id: $themeId) {
    id
    name
    files(first: $first, after: $after, filenames: $filenames) {
      edges {
        cursor
        node {
          filename
          contentType
          size
          checksumMd5
          body {
            ... on OnlineStoreThemeFileBodyText {
              content
            }
            ... on OnlineStoreThemeFileBodyBase64 {
              contentBase64
            }
            ... on OnlineStoreThemeFileBodyUrl {
              url
            }
          }
        }
      }
      pageInfo {
        hasNextPage
        endCursor
      }
    }
  }
}
`;

export const UPDATE_THEME_FILES_MUTATION = `#graphql
mutation UpdateThemeFiles($themeId: ID!, $files: [OnlineStoreThemeFilesUpsertFileInput!]!) {
  themeFilesUpsert(themeId: $themeId, files: $files) {
    upsertedThemeFiles {
      filename
    }
    job {
      id
    }
    userErrors {
      field
      message
    }
  }
}
`;
