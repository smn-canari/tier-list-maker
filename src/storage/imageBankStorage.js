import localforage from 'localforage'

const IMAGE_BANK_KEY = 'images'

const imageBankStore = localforage.createInstance({
  name: 'tier-list-maker',
  storeName: 'image_bank',
})

export async function loadStoredImages() {
  return (await imageBankStore.getItem(IMAGE_BANK_KEY)) ?? []
}

export async function saveStoredImages(images) {
  const storedImages = images.map((image) => ({
    id: image.id,
    name: image.name,
    size: image.size,
    type: image.type,
    lastModified: image.lastModified,
    blob: image.blob,
  }))

  await imageBankStore.setItem(IMAGE_BANK_KEY, storedImages)
}
