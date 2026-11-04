/** Error con código HTTP y mensaje seguro para mostrar a la persona usuaria. */
export class AppError extends Error {
  constructor(
    public readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "AppError";
  }
}

export class ConfigError extends AppError {
  constructor(message: string) {
    super(503, message);
    this.name = "ConfigError";
  }
}
