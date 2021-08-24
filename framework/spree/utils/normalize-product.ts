import type {
  Product,
  ProductOption,
  ProductPrice,
  ProductVariant,
} from '@commerce/types/product'
import type {
  JsonApiListResponse,
  JsonApiSingleResponse,
} from '@spree/storefront-api-v2-sdk/types/interfaces/JsonApi'
import type { ProductAttr } from '@spree/storefront-api-v2-sdk/types/interfaces/Product'
import type { RelationType } from '@spree/storefront-api-v2-sdk/types/interfaces/Relationships'
import { requireConfigValue } from '@framework/isomorphic-config'
import createGetAbsoluteImageUrl from './create-get-absolute-image-url'
import expandOptions from './expand-options'
import getMediaGallery from './get-media-gallery'
import { findIncluded, findIncludedOfType } from './find-json-api-documents'
import getProductPath from './get-product-path'
import MissingPrimaryVariantError from '@framework/errors/MissingPrimaryVariantError'

const normalizeProduct = (
  spreeSuccessResponse: JsonApiSingleResponse | JsonApiListResponse,
  spreeProduct: ProductAttr
): Product => {
  const primaryVariantIdentifier = spreeProduct.relationships.primary_variant
    .data as RelationType
  const primaryVariant = findIncluded(
    spreeSuccessResponse,
    primaryVariantIdentifier.type,
    primaryVariantIdentifier.id
  )

  if (primaryVariant === null) {
    throw new MissingPrimaryVariantError(
      `Couldn't find primary variant with id ${primaryVariantIdentifier.id}.`
    )
  }

  const sku = primaryVariant.attributes.sku

  const spreeImageRecords = findIncludedOfType(
    spreeSuccessResponse,
    spreeProduct,
    'images'
  )

  const images = getMediaGallery(
    spreeImageRecords,
    createGetAbsoluteImageUrl(requireConfigValue('imageHost') as string)
  )

  const price: ProductPrice = {
    value: parseFloat(spreeProduct.attributes.price),
    currencyCode: spreeProduct.attributes.currency,
  }

  const hasNonMasterVariants =
    (spreeProduct.relationships.variants.data as RelationType[]).length > 1

  const showOptions =
    (requireConfigValue('showSingleVariantOptions') as boolean) ||
    hasNonMasterVariants

  let variants: ProductVariant[]
  let options: ProductOption[] = []

  const spreeVariantRecords = findIncludedOfType(
    spreeSuccessResponse,
    spreeProduct,
    'variants'
  )

  variants = spreeVariantRecords.map((spreeVariantRecord) => {
    let variantOptions: ProductOption[] = []

    if (showOptions) {
      const spreeOptionValues = findIncludedOfType(
        spreeSuccessResponse,
        spreeVariantRecord,
        'option_values'
      )

      // Only include options which are used by variants.

      spreeOptionValues.forEach((spreeOptionValue) => {
        variantOptions = expandOptions(
          spreeSuccessResponse,
          spreeOptionValue,
          variantOptions
        )

        options = expandOptions(spreeSuccessResponse, spreeOptionValue, options)
      })
    }

    return {
      id: spreeVariantRecord.id,
      options: variantOptions,
    }
  })

  const slug = spreeProduct.attributes.slug
  const path = getProductPath(spreeProduct)

  return {
    id: spreeProduct.id,
    name: spreeProduct.attributes.name,
    description: spreeProduct.attributes.description,
    images,
    variants,
    options,
    price,
    slug,
    path,
    sku,
  }
}

export default normalizeProduct
