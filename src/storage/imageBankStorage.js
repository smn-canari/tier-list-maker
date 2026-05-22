import localforage from 'localforage'

const LEGACY_IMAGES_KEY = 'images'
const IMAGES_BY_ID_KEY = 'imagesById'
const IMAGE_ORDER_KEY = 'imageOrder'

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
  const [storedImagesById, storedImageOrder] = await Promise.all([
    imageBankStore.getItem(IMAGES_BY_ID_KEY),
    imageBankStore.getItem(IMAGE_ORDER_KEY),
  ])

  if (storedImagesById && storedImageOrder) {
    const imagesById = storedImagesById
    const imageOrder = storedImageOrder.filter((id) => imagesById[id])

    return { imagesById, imageOrder }
  }

  const legacyImages = (await imageBankStore.getItem(LEGACY_IMAGES_KEY)) ?? []
  const imagesById = Object.fromEntries(
    legacyImages.map((image) => [image.id, prepareStoredImage(image)]),
  )
  const imageOrder = legacyImages.map((image) => image.id)

  if (legacyImages.length > 0) {
    await saveStoredImageBank({ imagesById, imageOrder })
    await imageBankStore.removeItem(LEGACY_IMAGES_KEY)
  }

  return { imagesById, imageOrder }
}

export async function saveStoredImageBank({ imagesById, imageOrder }) {
  const storedImagesById = Object.fromEntries(
    Object.entries(imagesById).map(([id, image]) => [
      id,
      prepareStoredImage(image),
    ]),
  )

  await Promise.all([
    imageBankStore.setItem(IMAGES_BY_ID_KEY, storedImagesById),
    imageBankStore.setItem(IMAGE_ORDER_KEY, imageOrder),
  ])
}
