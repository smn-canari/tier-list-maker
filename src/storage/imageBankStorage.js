import localforage from 'localforage'

const LEGACY_IMAGES_KEY = 'images'
const IMAGES_BY_ID_KEY = 'imagesById'
const IMAGE_ORDER_KEY = 'imageOrder'
const UNPLACED_IMAGE_ORDER_KEY = 'unplacedImageOrder'
const TIERS_KEY = 'tiers'

export const DEFAULT_TIERS = [
  { id: 'tier-s', label: 'S', color: '#ef4444', imageIds: [] },
  { id: 'tier-a', label: 'A', color: '#f97316', imageIds: [] },
  { id: 'tier-b', label: 'B', color: '#eab308', imageIds: [] },
  { id: 'tier-c', label: 'C', color: '#22c55e', imageIds: [] },
  { id: 'tier-d', label: 'D', color: '#3b82f6', imageIds: [] },
]

function createDefaultTiers() {
  return DEFAULT_TIERS.map((tier) => ({ ...tier, imageIds: [] }))
}

const imageBankStore = localforage.createInstance({
  name: 'tier-list-maker',
  storeName: 'image_bank',
})

function prepareStoredImage(image) {
  return {
    id: image.id,
    name: image.name,
    size: image.size,
    type: image.type,
    lastModified: image.lastModified,
    blob: image.blob,
  }
}

export async function loadStoredImageBank() {
  const [storedImagesById, storedUnplacedImageOrder, storedTiers] =
    await Promise.all([
      imageBankStore.getItem(IMAGES_BY_ID_KEY),
      imageBankStore.getItem(UNPLACED_IMAGE_ORDER_KEY),
      imageBankStore.getItem(TIERS_KEY),
    ])

  if (storedImagesById && storedUnplacedImageOrder && storedTiers) {
    const imagesById = storedImagesById
    const tiers = mergeStoredTiers(storedTiers, imagesById)
    const placedImageIds = new Set(tiers.flatMap((tier) => tier.imageIds))
    const unplacedImageOrder = storedUnplacedImageOrder.filter(
      (id) => imagesById[id] && !placedImageIds.has(id),
    )

    return { imagesById, unplacedImageOrder, tiers }
  }

  const [storedImageOrder, legacyImages] = await Promise.all([
    imageBankStore.getItem(IMAGE_ORDER_KEY),
    imageBankStore.getItem(LEGACY_IMAGES_KEY),
  ])

  if (storedImagesById && storedImageOrder) {
    const imagesById = storedImagesById
    const unplacedImageOrder = storedImageOrder.filter((id) => imagesById[id])
    const tiers = createDefaultTiers()

    await saveStoredImageBank({ imagesById, unplacedImageOrder, tiers })
    await imageBankStore.removeItem(IMAGE_ORDER_KEY)

    return { imagesById, unplacedImageOrder, tiers }
  }

  const imageList = legacyImages ?? []
  const imagesById = Object.fromEntries(
    imageList.map((image) => [image.id, prepareStoredImage(image)]),
  )
  const unplacedImageOrder = imageList.map((image) => image.id)
  const tiers = createDefaultTiers()

  if (imageList.length > 0) {
    await saveStoredImageBank({ imagesById, unplacedImageOrder, tiers })
    await imageBankStore.removeItem(LEGACY_IMAGES_KEY)
  }

  return { imagesById, unplacedImageOrder, tiers }
}

export async function saveStoredImageBank({
  imagesById,
  unplacedImageOrder,
  tiers,
}) {
  const storedImagesById = Object.fromEntries(
    Object.entries(imagesById).map(([id, image]) => [
      id,
      prepareStoredImage(image),
    ]),
  )

  await Promise.all([
    imageBankStore.setItem(IMAGES_BY_ID_KEY, storedImagesById),
    imageBankStore.setItem(UNPLACED_IMAGE_ORDER_KEY, unplacedImageOrder),
    imageBankStore.setItem(TIERS_KEY, tiers),
  ])
}

function mergeStoredTiers(storedTiers, imagesById) {
  const storedTiersById = Object.fromEntries(
    storedTiers.map((tier) => [tier.id, tier]),
  )

  return DEFAULT_TIERS.map((defaultTier) => {
    const storedTier = storedTiersById[defaultTier.id]

    return {
      ...defaultTier,
      ...storedTier,
      imageIds: (storedTier?.imageIds ?? []).filter((id) => imagesById[id]),
    }
  })
}
