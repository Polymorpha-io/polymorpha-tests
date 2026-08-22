declare module "plotly.js/dist/plotly" {
  import type * as Plotly from "plotly.js";

  const PlotlyDist: typeof Plotly;
  export default PlotlyDist;
}
