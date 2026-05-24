"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import Countdown from "@/components/Countdown";

interface ReservationDetail {
  id:        string;
  status:    "PENDING" | "CONFIRMED" | "RELEASED";
  quantity:  number;
  expiresAt: string;
  product: {
    name:        string;
    description: string | null;
    price:       number;
  };
  warehouse: {
    name:     string;
    location: string;
  };
}

export default function ReservationPage({ params }: { params: { id: string } }) {
  const router = useRouter();
  const [reservation, setReservation]     = useState<ReservationDetail | null>(null);
  const [loading, setLoading]             = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [pageError, setPageError]         = useState<string | null>(null);
  const [actionError, setActionError]     = useState<string | null>(null);

  useEffect(() => {
    fetch(`/api/reservations/${params.id}`)
      .then((res) => { if (!res.ok) throw new Error(); return res.json(); })
      .then(setReservation)
      .catch(() => setPageError("Reservation not found."))
      .finally(() => setLoading(false));
  }, [params.id]);

  async function handleConfirm() {
    setActionLoading(true);
    setActionError(null);
    try {
      const res  = await fetch(`/api/reservations/${params.id}/confirm`, { method: "POST" });
      const data = await res.json();
      if (res.status === 410) {
        setActionError(`⚠️ ${data.error}`);
        setReservation((prev) => prev ? { ...prev, status: "RELEASED" } : null);
        return;
      }
      if (!res.ok) { setActionError("Failed to confirm. Please try again."); return; }
      setReservation(data);
    } catch { setActionError("Network error."); }
    finally { setActionLoading(false); }
  }

  async function handleCancel() {
    setActionLoading(true);
    setActionError(null);
    try {
      const res = await fetch(`/api/reservations/${params.id}/release`, { method: "POST" });
      if (!res.ok) { setActionError("Failed to cancel. Please try again."); return; }
      setReservation(await res.json());
    } catch { setActionError("Network error."); }
    finally { setActionLoading(false); }
  }

  const handleExpired = useCallback(() => {
    setReservation((prev) => prev ? { ...prev, status: "RELEASED" } : null);
    setActionError("⏰ Your reservation has expired. The item is back in stock.");
  }, []);

  if (loading) return (
    <main className="flex items-center justify-center py-32">
      <p className="text-gray-400 text-lg">Loading...</p>
    </main>
  );

  if (pageError || !reservation) return (
    <main className="flex flex-col items-center justify-center py-32 gap-4">
      <p className="text-red-500">{pageError ?? "Something went wrong."}</p>
      <button onClick={() => router.push("/")} className="text-indigo-600 hover:underline text-sm">
        ← Back to products
      </button>
    </main>
  );

  const { status, quantity, expiresAt, product, warehouse } = reservation;
  const total = product.price * quantity;

  return (
    <main className="max-w-lg mx-auto px-4 py-10">
      <button onClick={() => router.push("/")} className="text-sm text-indigo-600 hover:underline mb-6 inline-block">
        ← Back to products
      </button>

      <div className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
        <h1 className="text-2xl font-bold text-gray-900 mb-5">Checkout</h1>

        <div className="mb-5">
          {status === "CONFIRMED" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-green-100 text-green-700 rounded-full text-sm font-semibold">
              ✓ Payment Confirmed
            </span>
          )}
          {status === "RELEASED" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-red-100 text-red-600 rounded-full text-sm font-semibold">
              ✗ Reservation Released
            </span>
          )}
          {status === "PENDING" && (
            <span className="inline-flex items-center gap-1.5 px-3 py-1 bg-yellow-100 text-yellow-700 rounded-full text-sm font-semibold">
              ⏳ Awaiting Payment
            </span>
          )}
        </div>

        <div className="border-t border-gray-100 pt-5 space-y-2">
          <div>
            <p className="font-semibold text-gray-900">{product.name}</p>
            {product.description && (
              <p className="text-gray-500 text-sm mt-0.5">{product.description}</p>
            )}
          </div>
          <div className="flex justify-between text-sm text-gray-600 pt-2">
            <span>Warehouse</span>
            <span className="font-medium text-gray-800">{warehouse.name}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Location</span>
            <span className="font-medium text-gray-800">{warehouse.location}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Quantity</span>
            <span className="font-medium text-gray-800">{quantity}</span>
          </div>
          <div className="flex justify-between text-sm text-gray-600">
            <span>Unit price</span>
            <span className="font-medium text-gray-800">₹{product.price.toLocaleString("en-IN")}</span>
          </div>
          <div className="flex justify-between font-bold text-gray-900 pt-2 border-t border-gray-100 text-lg">
            <span>Total</span>
            <span>₹{total.toLocaleString("en-IN")}</span>
          </div>
        </div>

        {status === "PENDING" && (
          <div className="mt-5 bg-yellow-50 border border-yellow-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-yellow-700 uppercase tracking-wide mb-2">
              Hold expires in
            </p>
            <Countdown expiresAt={expiresAt} onExpired={handleExpired} />
            <p className="text-xs text-yellow-600 mt-2">Complete payment before time runs out.</p>
          </div>
        )}

        {actionError && (
          <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
            {actionError}
          </div>
        )}

        {status === "PENDING" && (
          <div className="mt-6 flex gap-3">
            <button
              onClick={handleConfirm}
              disabled={actionLoading}
              className="flex-1 py-3 bg-indigo-600 text-white font-semibold rounded-xl hover:bg-indigo-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {actionLoading ? "Processing..." : "Confirm Purchase"}
            </button>
            <button
              onClick={handleCancel}
              disabled={actionLoading}
              className="flex-1 py-3 bg-white text-gray-700 font-semibold rounded-xl border border-gray-300 hover:bg-gray-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              Cancel
            </button>
          </div>
        )}

        {status === "CONFIRMED" && (
          <div className="mt-6 text-center">
            <p className="text-green-600 font-medium mb-4">🎉 Order confirmed! Thank you.</p>
            <button onClick={() => router.push("/")} className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-semibold">
              Continue Shopping
            </button>
          </div>
        )}

        {status === "RELEASED" && !actionError && (
          <div className="mt-6 text-center">
            <p className="text-gray-500 mb-4 text-sm">This hold has been released.</p>
            <button onClick={() => router.push("/")} className="px-6 py-2 bg-indigo-600 text-white rounded-xl hover:bg-indigo-700 font-semibold">
              Browse Products
            </button>
          </div>
        )}
      </div>
      <p className="text-center text-xs text-gray-300 mt-4">ID: {reservation.id}</p>
    </main>
  );
}