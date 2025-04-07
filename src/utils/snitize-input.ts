import sanitizeHtml from "sanitize-html";
import type { ParamsDictionary } from "express-serve-static-core";
import type { Request, Response, NextFunction } from "express";
import type { ParsedQs } from "qs";

const sanitizeInput = (
  req: Request,
  _res: Response,
  next: NextFunction
): void => {
  if (req.body) {
    req.body = sanitize(req.body);
  }
  if (req.query) {
    req.query = sanitize(req.query) as ParsedQs;
  }
  if (req.params) {
    req.params = sanitize(req.params) as ParamsDictionary;
  }
  next();
};

function sanitize(obj: Record<string, unknown>): Record<string, unknown> {
  function sanitizeValue(value: unknown): unknown {
    if (typeof value === "string") {
      return sanitizeHtml(value, {
        allowedTags: [...sanitizeHtml.defaults.allowedTags, "img", "iframe"],
        allowedAttributes: {
          a: ["href"],
          img: ["src"],
          iframe: ["src"],
        },
        selfClosing: ["img", "br", "hr", "input", "link", "meta"],
        allowedIframeHostnames: ["www.youtube.com"],
        transformTags: {
          iframe: (tagName, attribs) => {
            // Parse the src URL
            try {
              const url = new URL(attribs.src);
              // If hostname matches allowed list, keep the iframe
              if (url.hostname === "www.youtube.com") {
                return {
                  tagName,
                  attribs,
                };
              }
            } catch {
              // Invalid URL, remove the tag
              return {
                tagName: "",
                attribs: {},
              };
            }
            // If hostname doesn't match or URL is invalid, remove the tag
            return {
              tagName: "",
              attribs: {},
            };
          },
        },
      });
    } else if (Array.isArray(value)) {
      return value.map((item) => sanitizeValue(item));
    } else if (isObject(value)) {
      const newObj: Record<string, unknown> = {};
      const objValue = value as Record<string, unknown>;
      for (const key in objValue) {
        newObj[key] = sanitizeValue(objValue[key]);
      }
      return newObj;
    }
    return value;
  }

  const result: Record<string, unknown> = {};
  for (const key in obj) {
    result[key] = sanitizeValue(obj[key]);
  }
  return result;
}

function isObject(value: unknown): boolean {
  return (
    value !== null &&
    typeof value === "object" &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

export default sanitizeInput;
