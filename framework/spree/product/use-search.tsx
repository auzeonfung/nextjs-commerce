import type { Fetcher, SWRHook } from '@commerce/utils/types'
import useSearch from '@commerce/product/use-search'
import type { Product, SearchProductsHook } from '@commerce/types/product'
import type { UseSearch } from '@commerce/product/use-search'
import normalizeProduct from '../utils/normalizeProduct'
import type { GraphQLFetcherResult } from '@commerce/api'
import { IProducts } from '@spree/storefront-api-v2-sdk/types/interfaces/Product'

export const handler: SWRHook<SearchProductsHook> = {
  fetchOptions: {
    url: '__UNUSED__',
    query: '',
  },
  async fetcher({ input, options, fetch }) {
    // This method is only needed if the options need to be modified before calling the generic fetcher (created in createFetcher).
    // TODO: Actually filter by input and query.

    console.info(
      'useSearch fetcher called. Configuration: ',
      'input: ',
      input,
      'options: ',
      options
    )

    const taxons = [input.categoryId, input.brandId].filter(Boolean)

    const filter =
      taxons.length > 0
        ? {
            filter: {
              taxons: taxons.join(','),
            },
          }
        : {}

    const { data: spreeSuccessResponse } = await fetch<
      GraphQLFetcherResult<IProducts>
    >({
      variables: {
        methodPath: 'products.list',
        arguments: [
          {
            include: 'variants,images,option_types,variants.option_values',
            per_page: 50,
            ...filter,
          },
        ],
      },
    })

    const normalizedProducts: Product[] = spreeSuccessResponse.data.map(
      (spreeProduct) => normalizeProduct(spreeSuccessResponse, spreeProduct)
    )

    const found = spreeSuccessResponse.data.length > 0

    return { products: normalizedProducts, found }
  },
  // useHook is used for both, SWR and mutation requests to the store.
  // useHook is called in React components. For example, after clicking `Add to cart`.
  useHook:
    ({ useData }) =>
    (input = {}) => {
      // useData calls the fetcher method (above).
      // The difference between useHook and calling fetcher directly is
      // useHook accepts swrOptions.

      console.log('useSearch useHook called.')

      return useData({
        input: [
          ['search', input.search],
          ['categoryId', input.categoryId],
          ['brandId', input.brandId],
          ['sort', input.sort],
        ],
        swrOptions: {
          revalidateOnFocus: false,
          // revalidateOnFocus: false means do not fetch products again when website is refocused in the web browser.
          ...input.swrOptions,
        },
      })
    },
}

export default useSearch as UseSearch<typeof handler>
