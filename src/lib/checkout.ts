type CartItemForCheckout = {
  product: {
    sellerId: string;
  };
  quantity: number;
  unitPriceCts: number;
};

export function groupCartItemsBySeller<T extends CartItemForCheckout>(items: T[]) {
  const groupedBySeller = new Map<string, T[]>();

  for (const item of items) {
    const group = groupedBySeller.get(item.product.sellerId) ?? [];
    group.push(item);
    groupedBySeller.set(item.product.sellerId, group);
  }

  return groupedBySeller;
}

export function calculateOrderTotalCents<T extends Pick<CartItemForCheckout, "quantity" | "unitPriceCts">>(
  items: T[],
) {
  return items.reduce((sum, item) => sum + item.unitPriceCts * item.quantity, 0);
}
