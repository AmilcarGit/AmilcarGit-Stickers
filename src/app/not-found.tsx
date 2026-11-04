import Link from "next/link";

export default function NotFound() {
  return (
    <div className="card mx-auto max-w-lg text-center">
      <p className="text-5xl" aria-hidden="true">
        🫥
      </p>
      <h1 className="mt-3 text-2xl font-bold">Página no encontrada</h1>
      <p className="mt-2 text-muted">Esa dirección no existe o fue movida.</p>
      <Link href="/" className="btn-primary mt-4 inline-flex">
        Volver al inicio
      </Link>
    </div>
  );
}
