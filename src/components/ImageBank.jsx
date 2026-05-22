import { useEffect, useMemo, useRef, useState } from 'react'
import {
  DndContext,
  KeyboardSensor,
  PointerSensor,
  closestCenter,
  useDroppable,
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
  DEFAULT_TIERS,
  loadStoredImageBank,
  saveStoredImageBank,
} from '../storage/imageBankStorage'

const UNPLACED_CONTAINER_ID = 'unplaced'

function formatFileSize(size) {
  if (size < 1024 * 1024) {
    return `${Math.max(1, Math.round(size / 1024))} KB`
  }

  return `${(size / (1024 * 1024)).toFixed(1)} MB`
}

function createDefaultTiers() {
  return DEFAULT_TIERS.map((tier) => ({ ...tier, imageIds: [] }))
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
      ref={setNodeRef}
      style={style}
      title="Drag to move or reorder"
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

function DroppableImageList({
  containerId,
  emptyText,
  imageIds,
  images,
  variant = 'grid',
}) {
  const { isOver, setNodeRef } = useDroppable({ id: containerId })

  return (
    <SortableContext items={imageIds} strategy={rectSortingStrategy}>
      <div
        className={`image-list image-list--${variant}${
          isOver ? ' image-list--over' : ''
        }`}
        ref={setNodeRef}
      >
        {images.length > 0 ? (
          images.map((image) => <SortableImageCard image={image} key={image.id} />)
        ) : (
          <p className="image-list__empty">{emptyText}</p>
        )}
      </div>
    </SortableContext>
  )
}

function ImageBank() {
  const [imagesById, setImagesById] = useState({})
  const [unplacedImageOrder, setUnplacedImageOrder] = useState([])
  const [tiers, setTiers] = useState(createDefaultTiers)
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

  const unplacedImages = useMemo(
    () => unplacedImageOrder.map((id) => imagesById[id]).filter(Boolean),
    [unplacedImageOrder, imagesById],
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
          setUnplacedImageOrder(storedImageBank.unplacedImageOrder)
          setTiers(storedImageBank.tiers)
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
        await saveStoredImageBank({ imagesById, unplacedImageOrder, tiers })
        setStorageError('')
      } catch {
        setStorageError('Images could not be saved in this browser.')
      }
    }

    persistImageBank()
  }, [imagesById, unplacedImageOrder, tiers])

  function getContainerItems(containerId) {
    if (containerId === UNPLACED_CONTAINER_ID) {
      return unplacedImageOrder
    }

    return tiers.find((tier) => tier.id === containerId)?.imageIds ?? []
  }

  function findContainerId(imageId) {
    if (unplacedImageOrder.includes(imageId)) {
      return UNPLACED_CONTAINER_ID
    }

    return tiers.find((tier) => tier.imageIds.includes(imageId))?.id
  }

  function updateContainerItems(containerId, nextImageIds) {
    if (containerId === UNPLACED_CONTAINER_ID) {
      setUnplacedImageOrder(nextImageIds)
      return
    }

    setTiers((currentTiers) =>
      currentTiers.map((tier) =>
        tier.id === containerId ? { ...tier, imageIds: nextImageIds } : tier,
      ),
    )
  }

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
    setUnplacedImageOrder((currentImageOrder) => [
      ...currentImageOrder,
      ...selectedImages.map((image) => image.id),
    ])
    event.target.value = ''
  }

  function handleDragEnd(event) {
    const { active, over } = event

    if (!over) {
      return
    }

    const activeId = active.id
    const overId = over.id
    const sourceContainerId = findContainerId(activeId)
    const targetContainerId =
      overId === UNPLACED_CONTAINER_ID || tiers.some((tier) => tier.id === overId)
        ? overId
        : findContainerId(overId)

    if (!sourceContainerId || !targetContainerId) {
      return
    }

    const sourceItems = getContainerItems(sourceContainerId)
    const targetItems = getContainerItems(targetContainerId)
    const sourceIndex = sourceItems.indexOf(activeId)

    if (sourceIndex === -1) {
      return
    }

    if (sourceContainerId === targetContainerId) {
      const targetIndex = targetItems.indexOf(overId)

      if (targetIndex === -1 || sourceIndex === targetIndex) {
        return
      }

      updateContainerItems(
        sourceContainerId,
        arrayMove(sourceItems, sourceIndex, targetIndex),
      )
      return
    }

    const targetIndex = targetItems.indexOf(overId)
    const nextSourceItems = sourceItems.filter((id) => id !== activeId)
    const nextTargetItems = [...targetItems]

    nextTargetItems.splice(
      targetIndex === -1 ? nextTargetItems.length : targetIndex,
      0,
      activeId,
    )

    updateContainerItems(sourceContainerId, nextSourceItems)
    updateContainerItems(targetContainerId, nextTargetItems)
  }

  return (
    <DndContext
      collisionDetection={closestCenter}
      onDragEnd={handleDragEnd}
      sensors={sensors}
    >
      <section className="tier-board" aria-label="Tier rows">
        {tiers.map((tier) => {
          const tierImages = tier.imageIds
            .map((imageId) => imagesById[imageId])
            .filter(Boolean)

          return (
            <div className="tier-row" key={tier.id}>
              <div
                className="tier-row__label"
                style={{ '--tier-color': tier.color }}
              >
                {tier.label}
              </div>
              <DroppableImageList
                containerId={tier.id}
                emptyText="Drop images here"
                imageIds={tier.imageIds}
                images={tierImages}
                variant="row"
              />
            </div>
          )
        })}
      </section>

      <section className="image-bank" aria-labelledby="image-bank-title">
        <div className="image-bank__header">
          <div>
            <h2 id="image-bank-title">Image Bank</h2>
            <p>
              {isLoading
                ? 'Restoring saved images'
                : `${unplacedImages.length} unplaced images`}
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

        <DroppableImageList
          containerId={UNPLACED_CONTAINER_ID}
          emptyText="Select multiple images to start building your bank."
          imageIds={unplacedImageOrder}
          images={unplacedImages}
        />
      </section>
    </DndContext>
  )
}

export default ImageBank
