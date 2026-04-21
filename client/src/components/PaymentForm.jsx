import React from "react";
import { getDownloadURL, ref, uploadBytes } from "firebase/storage";
import { storage } from "../firebase";

const fieldClassName =
  "h-11 rounded-2xl border border-slate-200 bg-white px-4 text-sm text-ink outline-none transition focus:border-amber focus:ring-4 focus:ring-amber/20";

function UploadIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[18px] w-[18px] fill-none stroke-current stroke-2">
      <path d="M12 16V5m0 0-4 4m4-4 4 4M5 19h14" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function RemoveIcon() {
  return (
    <svg viewBox="0 0 24 24" aria-hidden="true" className="h-[14px] w-[14px] fill-none stroke-current stroke-2">
      <path d="M6 6l12 12M18 6 6 18" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function LoadingState({ title, description }) {
  return (
    <div className="grid min-h-[260px] place-items-center rounded-[24px] border border-slate-200 bg-slate-50/80 px-6 py-10 text-center">
      <div>
        <div className="mx-auto h-12 w-12 animate-spin rounded-full border-4 border-slate-200 border-t-slateblue" />
        <h3 className="mt-4 text-lg font-semibold text-ink">{title}</h3>
        <p className="mt-2 text-sm text-slate-500">{description}</p>
      </div>
    </div>
  );
}

function buildInitialFormState(initialValues) {
  return {
    amount: initialValues?.amount ?? "",
    paymentDate: initialValues?.paymentDate ?? "",
    note: initialValues?.note ?? "",
  };
}

function buildInitialProofItems(initialValues) {
  return Array.isArray(initialValues?.proofImages)
    ? initialValues.proofImages.slice(0, 3).map((proofImage, index) => {
        const url = typeof proofImage === "string" ? proofImage : proofImage?.url || "";
        const path = typeof proofImage === "object" && proofImage?.path ? proofImage.path : "";

        return {
          id: `existing-${index}-${url.slice(-12)}`,
          previewUrl: url,
          uploadedUrl: url,
          uploadedPath: path,
          file: null,
        };
      })
    : [];
}

function sanitizeFileName(fileName) {
  return String(fileName || "proof")
    .toLowerCase()
    .replace(/[^a-z0-9.\-_]+/g, "-");
}

async function uploadProofFile(loanId, file) {
  const fileName = `${crypto.randomUUID()}-${sanitizeFileName(file.name)}`;
  const storagePath = `payment-proofs/${loanId}/${fileName}`;
  const storageRef = ref(storage, storagePath);
  await uploadBytes(storageRef, file);
  const url = await getDownloadURL(storageRef);

  return {
    url,
    path: storagePath,
  };
}

export default function PaymentForm({
  loanId,
  onSubmit,
  isSubmitting,
  initialValues = null,
  submitLabel = "Add payment",
  onDelete,
  isDeleting = false,
}) {
  const [formData, setFormData] = React.useState(() => buildInitialFormState(initialValues));
  const [proofItems, setProofItems] = React.useState(() => buildInitialProofItems(initialValues));
  const [uploadError, setUploadError] = React.useState("");
  const fileInputRef = React.useRef(null);

  React.useEffect(() => {
    setFormData(buildInitialFormState(initialValues));
    setProofItems(buildInitialProofItems(initialValues));
    setUploadError("");
  }, [initialValues]);

  React.useEffect(() => {
    return () => {
      proofItems.forEach((proofItem) => {
        if (proofItem.file && proofItem.previewUrl.startsWith("blob:")) {
          URL.revokeObjectURL(proofItem.previewUrl);
        }
      });
    };
  }, [proofItems]);

  function handleChange(event) {
    const { name, value } = event.target;
    setFormData((current) => ({
      ...current,
      [name]: value,
    }));
  }

  function handleRemoveProof(index) {
    setProofItems((current) => {
      const nextItems = current.filter((_, currentIndex) => currentIndex !== index);
      const removedItem = current[index];

      if (removedItem?.file && removedItem.previewUrl.startsWith("blob:")) {
        URL.revokeObjectURL(removedItem.previewUrl);
      }

      return nextItems;
    });
  }

  function handleProofSelection(event) {
    const selectedFiles = Array.from(event.target.files || []);

    if (selectedFiles.length === 0) {
      return;
    }

    const remainingSlots = 3 - proofItems.length;

    if (remainingSlots <= 0) {
      setUploadError("You can only upload up to 3 proof images.");
      event.target.value = "";
      return;
    }

    setUploadError("");

    const nextItems = selectedFiles.slice(0, remainingSlots).map((file) => ({
      id: crypto.randomUUID(),
      file,
      uploadedUrl: "",
      uploadedPath: "",
      previewUrl: URL.createObjectURL(file),
    }));

    setProofItems((current) => [...current, ...nextItems]);
    event.target.value = "";
  }

  async function handleSubmit(event) {
    event.preventDefault();

    try {
      setUploadError("");

      const proofImages = await Promise.all(
        proofItems.map(async (proofItem) => {
          if (proofItem.uploadedUrl) {
            return {
              url: proofItem.uploadedUrl,
              path: proofItem.uploadedPath || "",
            };
          }

          if (!proofItem.file) {
            return null;
          }

          return uploadProofFile(loanId, proofItem.file);
        })
      );

      await onSubmit(loanId, {
        ...formData,
        amount: Number(formData.amount),
        proofImages: proofImages.filter(Boolean).slice(0, 3),
      });

      if (!initialValues) {
        proofItems.forEach((proofItem) => {
          if (proofItem.file && proofItem.previewUrl.startsWith("blob:")) {
            URL.revokeObjectURL(proofItem.previewUrl);
          }
        });
        setFormData(buildInitialFormState(null));
        setProofItems([]);
      }
    } catch (error) {
      setUploadError(error.message || "Failed to upload proof of payment.");
    }
  }

  return (
    isSubmitting || isDeleting ? (
      <LoadingState
        title={isDeleting ? "Removing payment" : initialValues ? "Updating payment" : "Saving payment"}
        description="Please wait while the payment record and proof details are being updated."
      />
    ) : (
    <form className="grid gap-4" onSubmit={handleSubmit}>
      <div className="grid gap-3">
        <div className="grid grid-cols-2 gap-3">
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Amount
            <input className={fieldClassName} name="amount" type="number" min="0" step="0.01" value={formData.amount} onChange={handleChange} required />
          </label>
          <label className="grid gap-2 text-sm font-semibold text-slate-700">
            Payment date
            <input className={fieldClassName} name="paymentDate" type="date" value={formData.paymentDate} onChange={handleChange} required />
          </label>
        </div>
        <label className="grid gap-2 text-sm font-semibold text-slate-700">
          Note
          <input className={fieldClassName} name="note" value={formData.note} onChange={handleChange} placeholder="Optional" />
        </label>
      </div>

      <div className="rounded-[24px] border border-sky-100 bg-sky-50/70 p-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <p className="text-sm font-semibold text-ink">Proof of payment</p>
            <p className="mt-1 text-sm text-slate-500">Upload up to 3 images and the app will store them in Firebase Storage.</p>
          </div>
          <div className="flex items-center gap-2">
            <input ref={fileInputRef} type="file" accept="image/*" multiple className="hidden" onChange={handleProofSelection} />
            <button
              type="button"
              className="inline-flex h-11 w-11 items-center justify-center rounded-full bg-slateblue text-white transition hover:-translate-y-0.5 hover:bg-[#334e77] focus:outline-none focus:ring-4 focus:ring-slate-200"
              onClick={() => fileInputRef.current?.click()}
              aria-label="Upload proof of payment"
              title="Upload proof of payment"
            >
              <UploadIcon />
            </button>
            <span className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-500">{proofItems.length}/3</span>
          </div>
        </div>

        {uploadError ? <p className="mt-3 text-sm font-medium text-rose-700">{uploadError}</p> : null}

        {proofItems.length > 0 ? (
          <div className="mt-4 grid grid-cols-3 gap-3">
            {proofItems.map((proofItem, index) => (
              <div key={proofItem.id} className="relative overflow-hidden rounded-2xl border border-sky-100 bg-white">
                <img src={proofItem.previewUrl} alt={`Proof of payment ${index + 1}`} className="h-24 w-full object-cover" />
                <button
                  type="button"
                  className="absolute right-2 top-2 inline-flex h-7 w-7 items-center justify-center rounded-full bg-ink/80 text-white transition hover:bg-ink"
                  onClick={() => handleRemoveProof(index)}
                  aria-label={`Remove proof image ${index + 1}`}
                >
                  <RemoveIcon />
                </button>
              </div>
            ))}
          </div>
        ) : null}
      </div>

      <div className="flex flex-col gap-3 sm:flex-row sm:justify-end">
        {onDelete ? (
          <button
            type="button"
            className="inline-flex h-11 items-center justify-center rounded-full bg-rose-50 px-5 text-sm font-semibold text-rose-700 transition hover:-translate-y-0.5 hover:bg-rose-100 disabled:cursor-wait disabled:opacity-70"
            onClick={onDelete}
            disabled={isDeleting || isSubmitting}
          >
            {isDeleting ? "Deleting..." : "Delete payment"}
          </button>
        ) : null}
        <button
          type="submit"
          className="inline-flex h-11 items-center justify-center rounded-full bg-ink px-5 text-sm font-semibold text-white transition hover:-translate-y-0.5 hover:bg-slateblue disabled:cursor-wait disabled:opacity-70"
          disabled={isSubmitting || isDeleting}
        >
          {isSubmitting ? "Saving..." : submitLabel}
        </button>
      </div>
    </form>
    )
  );
}
