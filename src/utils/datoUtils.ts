export const rgba2Hex = ({
  red,
  green,
  blue,
  alpha,
}: {
  red: number;
  green: number;
  blue: number;
  alpha: number;
}) => {
  return (
    "#" +
    [
      red.toString(16),
      green.toString(16),
      blue.toString(16),
      alpha.toString(16),
    ].join("")
  );
};
