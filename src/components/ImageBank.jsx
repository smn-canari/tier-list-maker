import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useSensor,
  useSensors,
} from '@dnd-kit/core'
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  sortableKeyboardCoordinates,
  useSortable,
} from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import {
  loadStoredImageBank,
  saveStoredImageBank,
} from '../storage/imageBankStorage'

function formatFileSize(size) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function SortableImageCard({ image }) {
  const {
    attributes,
    listeners,
    setNodeRef,
    transform,
    transition,
    isDragging,
  } = useSortable({ id: image.id })

  const style = {
    transform: CSS.Transform.toString(transform),
    transition,
  }

  return (
    <article
      className={`image-card${isDragging ? ' image-card--dragging' : ''}`}
      data-image-id={image.id}
      key={image.id}
      ref={setNodeRef}
      style={style}
      title="Drag to reorder"
      {...attributes}
      {...listeners}
    >
      <img src={image.previewUrl} alt={image.name} />
      <div className="image-card__meta">
        <strong>{image.name}</strong>
        <span>
          {image.type || 'image'} / {formatFileSize(image.size)}
        </span>
      </div>
    </article>
  )
}

function ImageBank() {
  const [imagesById, setImagesById] = useState({})
  const [imageOrder, setImageOrder] = useState([])
  const [isLoading, setIsLoading] = useState(true)
  const [storageError, setStorageError] = useState('')
  const objectUrlsRef = useRef(new Set())
  const hasLoadedStoredImagesRef = useRef(false)
  const sensors = useSensors(
    useSensor(PointerSensor, {
      activationConstraint: {
        distance: 6,
      },
    }),
    useSensor(KeyboardSensor, {
      coordinateGetter: sortableKeyboardCoordinates,
    }),
  )

  const images = useMemo(
    () => imageOrder.map((id) => imagesById[id]).filter(Boolean),
    [imageOrder, imagesById],
  )

  useEffect(() => {
    const objectUrls = objectUrlsRef.current
    let isMounted = true

    async function restoreImages() {
      try {
        const storedImageBank = await loadStoredImageBank()
        const restoredImagesById = Object.fromEntries(
          Object.entries(storedImageBank.imagesById).map(([id, image]) => {
            const previewUrl = URL.createObjectURL(image.blob)

            objectUrls.add(previewUrl)

            return [
              id,
              {
                ...image,
                previewUrl,
              },
            ]
          }),
        )

        if (isMounted) {
          setImagesById(restoredImagesById)
          setImageOrder(storedImageBank.imageOrder)
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

    async function persistImageBank() {
      try {
        await saveStoredImageBank({ imagesById, imageOrder })
        setStorageError('')
      } catch {
        setStorageError('Images could not be saved in this browser.')
      }
    }

    persistImageBank()
  }, [imagesById, imageOrder])

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

    setImagesById((currentImagesById) => ({
      ...currentImagesById,
      ...Object.fromEntries(selectedImages.map((image) => [image.id, image])),
    }))
    setImageOrder((currentImageOrder) => [
      ...currentImageOrder,
      ...selectedImages.map((image) => image.id),
    ])
    event.target.value = ''
  }

  function handleDragEnd(event) {
    const { active, over } = event

    if (!over || active.id === over.id) {
      return
    }

    setImageOrder((currentImageOrder) => {
      const oldIndex = currentImageOrder.indexOf(active.id)
      const newIndex = currentImageOrder.indexOf(over.id)

      if (oldIndex === -1 || newIndex === -1) {
        return currentImageOrder
      }

      return arrayMove(currentImageOrder, oldIndex, newIndex)
    })
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
        <DndContext
          collisionDetection={closestCenter}
          onDragEnd={handleDragEnd}
          sensors={sensors}
        >
          <SortableContext items={imageOrder} strategy={rectSortingStrategy}>
            <div className="image-bank__grid" aria-live="polite">
              {images.map((image) => (
                <SortableImageCard image={image} key={image.id} />
              ))}
            </div>
          </SortableContext>
        </DndContext>
      ) : (
        <div className="image-bank__empty">
          <p>Select multiple images to start building your bank.</p>
        </div>
      )}
    </section>
  )
}

export default ImageBank
