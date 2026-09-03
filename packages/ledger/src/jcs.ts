/**
 * RFC 8785 JSON Canonicalization Scheme (JCS).
 * @see https://www.rfc-editor.org/rfc/rfc8785
 *
 * Compatible with the reference JS behavior (sorted keys, ES number
 * serialization via JSON.stringify, reject NaN/Infinity).
 */
export function jcsCanonicalize(value: unknown): string {
  return serialize(value)
}

function serialize(object: unknown): string {
  if (typeof object === "number" && Number.isNaN(object)) {
    throw new Error("NaN is not allowed in JCS")
  }
  if (typeof object === "number" && !Number.isFinite(object)) {
    throw new Error("Infinity is not allowed in JCS")
  }

  if (object === null || typeof object !== "object") {
    return JSON.stringify(object)
  }

  if (typeof (object as { toJSON?: () => unknown }).toJSON === "function") {
    return serialize((object as { toJSON: () => unknown }).toJSON())
  }

  if (Array.isArray(object)) {
    const values = object.map((cv) => {
      const value = cv === undefined || typeof cv === "symbol" ? null : cv
      return serialize(value)
    })
    return `[${values.join(",")}]`
  }

  const obj = object as Record<string, unknown>
  const values = Object.keys(obj)
    .sort()
    .reduce((t, key) => {
      const v = obj[key]
      if (v === undefined || typeof v === "symbol") return t
      const comma = t.length === 0 ? "" : ","
      return `${t}${comma}${serialize(key)}:${serialize(v)}`
    }, "")
  return `{${values}}`
}
