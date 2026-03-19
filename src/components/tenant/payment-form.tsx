"use client";

import { useState } from "react";
import Button from "@/components/ui/button";
import { useCreatePayment } from "@/hooks/use-payments";

export default function PaymentForm({ tenantId }: { tenantId: string }) {
  const [amount, setAmount] = useState("");
  const [date, setDate] = useState(new Date().toISOString().split("T")[0]);
  const [method, setMethod] = useState("");
  const [notes, setNotes] = useState("");
  const createPayment = useCreatePayment(tenantId);

  function handleSubmit() {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    createPayment.mutate(
      { amount: amt, date, method: method || null, notes: notes || null } as any,
      {
        onSuccess: () => {
          setAmount("");
          setMethod("");
          setNotes("");
        },
      }
    );
  }

  return (
    <div className="space-y-3">
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="block text-xs text-text-dim mb-1">Amount</label>
          <input
            type="number"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            placeholder="0.00"
            className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
          />
        </div>
        <div>
          <label className="block text-xs text-text-dim mb-1">Date</label>
          <input
            type="date"
            value={date}
            onChange={(e) => setDate(e.target.value)}
            className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
          />
        </div>
      </div>
      <div>
        <label className="block text-xs text-text-dim mb-1">Method</label>
        <select
          value={method}
          onChange={(e) => setMethod(e.target.value)}
          className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
        >
          <option value="">Select method</option>
          <option value="check">Check</option>
          <option value="cash">Cash</option>
          <option value="money-order">Money Order</option>
          <option value="ach">ACH/Wire</option>
          <option value="online">Online Payment</option>
          <option value="other">Other</option>
        </select>
      </div>
      <div>
        <label className="block text-xs text-text-dim mb-1">Notes</label>
        <input
          type="text"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional notes..."
          className="w-full bg-bg border border-border rounded-lg px-3 py-1.5 text-sm text-text-primary focus:outline-none focus:border-accent"
        />
      </div>
      <Button size="sm" onClick={handleSubmit} disabled={!amount || createPayment.isPending}>
        {createPayment.isPending ? "Recording..." : "Record Payment"}
      </Button>
    </div>
  );
}
