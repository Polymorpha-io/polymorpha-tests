export type TaskType = "classification" | "regression";

export interface HyperparamDef {
  key: string;
  label: string;
  type: "int" | "float" | "enum";
  default: number | string | null;
  min?: number;
  max?: number;
  step?: number;
  options?: string[];
  description: string;
  nullable?: boolean;
}

export interface AlgorithmDef {
  key: string;
  label: string;
  tasks: TaskType[];
  hyperparams: HyperparamDef[];
}

export const ALGORITHMS: AlgorithmDef[] = [
  {
    key: "knn",
    label: "K-Nearest Neighbors",
    tasks: ["classification", "regression"],
    hyperparams: [
      {
        key: "n_neighbors",
        label: "K neighbors",
        type: "int",
        default: 5,
        min: 1,
        max: 50,
        step: 1,
        description: "Number of neighbors",
      },
      {
        key: "weights",
        label: "Weights",
        type: "enum",
        default: "uniform",
        options: ["uniform", "distance"],
        description: "Weight function",
      },
      {
        key: "metric",
        label: "Distance metric",
        type: "enum",
        default: "minkowski",
        options: ["minkowski", "euclidean", "manhattan", "chebyshev"],
        description: "Distance metric",
      },
    ],
  },
  {
    key: "random_forest",
    label: "Random Forest",
    tasks: ["classification", "regression"],
    hyperparams: [
      {
        key: "n_estimators",
        label: "Trees",
        type: "int",
        default: 100,
        min: 10,
        max: 500,
        step: 10,
        description: "Number of trees",
      },
      {
        key: "max_depth",
        label: "Max depth",
        type: "int",
        default: null,
        min: 1,
        max: 30,
        step: 1,
        nullable: true,
        description: "Max tree depth (empty = unlimited)",
      },
    ],
  },
  {
    key: "decision_tree",
    label: "Decision Tree",
    tasks: ["classification", "regression"],
    hyperparams: [
      {
        key: "max_depth",
        label: "Max depth",
        type: "int",
        default: null,
        min: 1,
        max: 30,
        step: 1,
        nullable: true,
        description: "Max tree depth (empty = unlimited)",
      },
    ],
  },
  {
    key: "logistic_regression",
    label: "Logistic Regression",
    tasks: ["classification"],
    hyperparams: [
      {
        key: "C",
        label: "C (regularization)",
        type: "float",
        default: 1.0,
        min: 0.01,
        max: 100,
        step: 0.1,
        description: "Inverse regularization strength",
      },
      {
        key: "max_iter",
        label: "Max iterations",
        type: "int",
        default: 1000,
        min: 100,
        max: 10000,
        step: 100,
        description: "Max solver iterations",
      },
    ],
  },
  {
    key: "linear_regression",
    label: "Linear Regression",
    tasks: ["regression"],
    hyperparams: [],
  },
  {
    key: "ridge",
    label: "Ridge Regression",
    tasks: ["regression"],
    hyperparams: [
      {
        key: "alpha",
        label: "Alpha (L2)",
        type: "float",
        default: 1.0,
        min: 0.01,
        max: 100,
        step: 0.1,
        description: "L2 regularization strength",
      },
    ],
  },
  {
    key: "lasso",
    label: "Lasso Regression",
    tasks: ["regression"],
    hyperparams: [
      {
        key: "alpha",
        label: "Alpha (L1)",
        type: "float",
        default: 1.0,
        min: 0.01,
        max: 100,
        step: 0.1,
        description: "L1 regularization strength",
      },
      {
        key: "max_iter",
        label: "Max iterations",
        type: "int",
        default: 1000,
        min: 100,
        max: 10000,
        step: 100,
        description: "Max solver iterations",
      },
    ],
  },
  {
    key: "svm",
    label: "Support Vector Machine",
    tasks: ["classification", "regression"],
    hyperparams: [
      {
        key: "C",
        label: "C (regularization)",
        type: "float",
        default: 1.0,
        min: 0.01,
        max: 100,
        step: 0.1,
        description: "Regularization parameter",
      },
      {
        key: "kernel",
        label: "Kernel",
        type: "enum",
        default: "rbf",
        options: ["rbf", "linear", "poly", "sigmoid"],
        description: "Kernel function",
      },
      {
        key: "max_iter",
        label: "Max iterations",
        type: "int",
        default: 5000,
        min: 1000,
        max: 50000,
        step: 1000,
        description: "Iteration limit",
      },
    ],
  },
  {
    key: "naive_bayes",
    label: "Naive Bayes",
    tasks: ["classification"],
    hyperparams: [],
  },
  {
    key: "gradient_boosting",
    label: "Gradient Boosting",
    tasks: ["classification", "regression"],
    hyperparams: [
      {
        key: "n_estimators",
        label: "Estimators",
        type: "int",
        default: 100,
        min: 10,
        max: 500,
        step: 10,
        description: "Number of boosting stages",
      },
      {
        key: "learning_rate",
        label: "Learning rate",
        type: "float",
        default: 0.1,
        min: 0.01,
        max: 1.0,
        step: 0.01,
        description: "Step size shrinkage",
      },
      {
        key: "max_depth",
        label: "Max depth",
        type: "int",
        default: 3,
        min: 1,
        max: 20,
        step: 1,
        description: "Max depth per tree",
      },
    ],
  },
];
