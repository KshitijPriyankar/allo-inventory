"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

interface StockInfo {
  warehouseId: string;
  warehouseName: string;
  warehouseLocation: string;
  available: number;
}

interface Product {
  id: string;
  name: string;
  description: string | null;
  price: number;
  stocks: StockInfo[];
}

export default function HomePage() {
  const router = useRouter();
  const [products, setProducts]   = useState<Product[]>([]);
  const [loading, setLoading]     = useState(true);
  const [reserving, setReserving] = useState<string | null>(null);
  const [error, setError]         = useState<string | null>(null);

  useEffect(() => {
    fetch("/api/products")
      .then((res) => res.json())
      .then((data) => setProducts(data))
      .catch(() => setError("Failed to load products. Please refresh."))
      .finally(() => setLoading(false));
  }, []);

  async function handleReserve(productId: string, warehouseId: string) {
    const key = `${productId}:${warehouseId}`;
    setReserving(key);
    setError(null);
    try {
      const res = await fetch("/api/reservations", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ productId, warehouseId, quantity: 1 }),
      });
      if (res.status === 409) {
        const data = await res.json();
        setError(`⚠️ ${data.error}`);
        return;
      }
      if (!res.ok) {
        setError("Something went wrong. Please try again.");
        return;
      }
      const reservation = await res.json();
      router.push(`/reservation/${reservation.id}`);
    } catch {
      setError("Network error. Please check your connection.");
    } finally {
      setReserving(null);
    }
  }

  if (loading) {
    return (
      <main className="flex items-center justify-center py-32">
        <p className="text-gray-400 text-lg">Loading products...</p>
      </main>
    );
  }

  return (
    <main className="max-w-4xl mx-auto px-4 py-10">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Products</h1>
        <p className="text-gray-500 mt-1 text-sm">
          Reserve a product to hold your spot for 10 minutes while you complete payment.
        </p>
      </div>

      {error && (
        <div className="mb-6 p-4 bg-red-50 border border-red-200 rounded-xl text-red-700 text-sm">
          {error}
          <button onClick={() => setError(null)} className="ml-4 text-red-400 hover:text-red-600 font-medium">
            Dismiss
          </button>
        </div>
      )}

      <div className="grid gap-5">
        {products.map((product) => (
          <div key={product.id} className="bg-white rounded-2xl shadow-sm border border-gray-200 p-6">
            <div className="flex items-start justify-between mb-5">
              <div>
                <h2 className="text-lg font-semibold text-gray-900">{product.name}</h2>
                {product.description && (
                  <p className="text-gray-500 text-sm mt-1">{product.description}</p>
                )}
              </div>
              <p className="text-2xl font-bold text-gray-900">
                ₹{product.price.toLocaleString("en-IN")}
              </p>
            </div>

            <div>
              <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-2">
                Available at
              </p>
              <div className="space-y-2">
                {product.stocks.map((stock) => {
                  const key = `${product.id}:${stock.warehouseId}`;
                  const isReserving  = reserving === key;
                  const isOutOfStock = stock.available === 0;
                  return (
                    <div key={stock.warehouseId} className="flex items-center justify-between bg-gray-50 rounded-xl px-4 py-3">
                      <div>
                        <p className="font-medium text-gray-800 text-sm">{stock.warehouseName}</p>
                        <p className="text-xs text-gray-400">{stock.warehouseLocation}</p>
                      </div>
                      <div className="flex items-center gap-4">
                        <span className={`text-sm font-semibold ${isOutOfStock ? "text-red-400" : "text-green-600"}`}>
                          {isOutOfStock
                            ? "Out of stock"
                            : `${stock.available} unit${stock.available === 1 ? "" : "s"} left`}
                        </span>
                        <button
                          onClick={() => handleReserve(product.id, stock.warehouseId)}
                          disabled={isOutOfStock || reserving !== null}
                          className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${
                            isOutOfStock || reserving !== null
                              ? "bg-gray-100 text-gray-400 cursor-not-allowed"
                              : "bg-indigo-600 text-white hover:bg-indigo-700"
                          }`}
                        >
                          {isReserving ? "Reserving..." : "Reserve"}
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
        ))}
      </div>
    </main>
  );
}