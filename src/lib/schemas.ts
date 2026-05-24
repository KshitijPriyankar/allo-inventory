import { z } from "zod";

export const CreateReservationSchema = z.object({
  productId:   z.string().min(1, "productId is required"),
  warehouseId: z.string().min(1, "warehouseId is required"),
  quantity:    z.number().int().positive().default(1),
});

export type CreateReservationInput = z.infer<typeof CreateReservationSchema>;