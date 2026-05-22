import { useEffect, useRef, useState } from 'react'
import { loadStoredImages, saveStoredImages } from '../storage/imageBankStorage'

function formatFileSize(size) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function ImageBank() {
  const [images, setImages] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [storageError, setStorageError] = useState('')
  const objectUrlsRef = useRef(new Set())
  const hasLoadedStoredImagesRef = useRef(false)

  useEffect(() => {
    const objectUrls = objectUrlsRef.current
    let isMounted = true

    async function restoreImages() {
      try {
        const storedImages = await loadStoredImages()
        const restoredImages = storedImages.map((image) => {
          const previewUrl = URL.createObjectURL(image.blob)

          objectUrls.add(previewUrl)

          return {
            ...image,
            previewUrl,
          }
        })

        if (isMounted) {
          setImages(restoredImages)
        }
      } catch {
        if (isMounted) {
          setStorageError('Saved images could not be restored.')
        }
      } finally {
        if (isMounted) {
          hasLoadedStoredImagesRef.current = true
          setIsLoading(false)
        }
      }
    }

    restoreImages()

    return () => {
      isMounted = false
      objectUrls.forEach((previewUrl) => {
        URL.revokeObjectURL(previewUrl)
      })
    }
  }, [])

  useEffect(() => {
    if (!hasLoadedStoredImagesRef.current) {
      return
    }

    async function persistImages() {
      try {
        await saveStoredImages(images)
        setStorageError('')
      } catch {
        setStorageError('Images could not be saved in this browser.')
      }
    }

    persistImages()
  }, [images])

  function handleImageSelect(event) {
    const selectedImages = Array.from(event.target.files ?? [])
      .filter((file) => file.type.startsWith('image/'))
      .map((file) => ({
        id: `${file.name}-${file.size}-${file.lastModified}-${crypto.randomUUID()}`,
        name: file.name,
        size: file.size,
        type: file.type,
        lastModified: file.lastModified,
        blob: file,
        previewUrl: URL.createObjectURL(file),
      }))

    selectedImages.forEach((image) => {
      objectUrlsRef.current.add(image.previewUrl)
    })

    setImages((currentImages) => [...currentImages, ...selectedImages])
    event.target.value = ''
  }

  return (
    <section className="image-bank" aria-labelledby="image-bank-title">
      <div className="image-bank__header">
        <div>
          <h2 id="image-bank-title">Image Bank</h2>
          <p>
            {isLoading
              ? 'Restoring saved images'
              : `${images.length} images ready for tiers`}
          </p>
        </div>

        <label className="image-bank__picker">
          <input
            type="file"
            accept="image/*"
            multiple
            onChange={handleImageSelect}
          />
          Add images
        </label>
      </div>

      {storageError ? (
        <p className="image-bank__status" role="status">
          {storageError}
        </p>
      ) : null}

      {images.length > 0 ? (
        <div className="image-bank__grid" aria-live="polite">
          {images.map((image) => (
            <article
              className="image-card"
              draggable="true"
              data-image-id={image.id}
              key={image.id}
              title="Drag behavior will be added later"
            >
              <img src={image.previewUrl} alt={image.name} />
              <div className="image-card__meta">
                <strong>{image.name}</strong>
                <span>
                  {image.type || 'image'} / {formatFileSize(image.size)}
                </span>
              </div>
            </article>
          ))}
        </div>
      ) : (
        <div className="image-bank__empty">
          <p>Select multiple images to start building your bank.</p>
        </div>
      )}
    </section>
  )
}

export default ImageBank
