import { cn } from "@/lib/utils";

const ProductPrice = ({
  value,
  className,
}: {
  value: number;
  className?: string;
}) => {
  // Format to two decimal places
  const stringValue = value.toFixed(2);

  //  Split the value into whole and decimal parts
  const [whole, decimal] = stringValue.split(".");

  return (
    <p className={cn("text-2xl", className)}>
      <span className="text-xs align-super">$</span>
      {whole}
      <span className="text-xs align-super">.{decimal}</span>
    </p>
  );
};

export default ProductPrice;
