# Pruebas de API e Integración con Postman

Este directorio contiene las colecciones de Postman diseñadas para automatizar la validación de respuestas HTTP y headers de enrutamiento de plantillas de BarberAgency.

## 📁 Archivos en este Directorio
*   **[barberagency-template-runtime.postman_collection.json](file:///root/github/barberagency-core/qa/postman/barberagency-template-runtime.postman_collection.json)**: Colección con requests predefinidas y scripts de validación de status y headers.

## 🚀 Cómo Ejecutar las Pruebas
Puedes importar la colección directamente en Postman o ejecutarla desde la terminal utilizando **Newman** (el CLI de Postman):

```bash
# Instalar newman globalmente (si no está instalado)
npm install -g newman

# Ejecutar las pruebas apuntando al host de pruebas o desarrollo local
newman run qa/postman/barberagency-template-runtime.postman_collection.json
```

## 🔍 Pruebas Automatizadas Incluidas
Cada request tiene scripts de testing JS integrados para validar:
- Estatus HTTP `200 OK`.
- Header `X-BarberAgency-Runtime` con valor esperado (`physical_registry` o `legacy`).
- Header `X-BarberAgency-Template-Id` coincidente con la versión de la plantilla cargada.
