import sanitizeInput from "../utils/snitize-input";
import { Request, Response, NextFunction } from "express";

describe("sanitizeInput middleware", () => {
  let mockReq: Partial<Request>;
  let mockRes: Partial<Response>;
  let nextFunction: NextFunction;

  beforeEach(() => {
    mockReq = {
      body: {
        name: "<script>alert('xss')</script>John <a href='safe.com'>Link</a>",
        nested: {
          html: "<p>Hello <strong>World</strong></p>",
          array: [
            "<script>alert('xss')</script><img src='safe.jpg' onclick='alert()'>",
          ],
        },
      },
      query: {
        search: "<script>alert('xss')</script><img src='safe.jpg'>",
        filter: {
          type: "<script>alert('xss')</script><iframe src='https://www.youtube.com/embed/123'></iframe>",
        },
      },
      params: {
        id: "<script>alert('xss')</script>123",
      },
    };
    mockRes = {};
    nextFunction = jest.fn();
  });

  it("should sanitize HTML in request body", () => {
    sanitizeInput(mockReq as Request, mockRes as Response, nextFunction);

    expect(mockReq.body).toEqual({
      name: 'John <a href="safe.com">Link</a>',
      nested: {
        html: "<p>Hello <strong>World</strong></p>",
        array: ['<img src="safe.jpg" />'],
      },
    });
  });

  it("should sanitize HTML in query parameters", () => {
    sanitizeInput(mockReq as Request, mockRes as Response, nextFunction);

    expect(mockReq.query).toEqual({
      search: '<img src="safe.jpg" />',
      filter: {
        type: '<iframe src="https://www.youtube.com/embed/123"></iframe>',
      },
    });
  });

  it("should sanitize HTML in route parameters", () => {
    sanitizeInput(mockReq as Request, mockRes as Response, nextFunction);

    expect(mockReq.params).toEqual({
      id: "123",
    });
  });

  it("should call next function", () => {
    sanitizeInput(mockReq as Request, mockRes as Response, nextFunction);
    expect(nextFunction).toHaveBeenCalled();
  });

  it("should handle null values", () => {
    mockReq.body = undefined;
    mockReq.query = undefined;
    mockReq.params = undefined;

    sanitizeInput(mockReq as Request, mockRes as Response, nextFunction);
    expect(nextFunction).toHaveBeenCalled();
  });

  it("should remove unsafe attributes", () => {
    mockReq.body = {
      content:
        "<a href='safe.com' onclick='alert()'>Link</a><img src='safe.jpg' onerror='alert()' />",
    };

    sanitizeInput(mockReq as Request, mockRes as Response, nextFunction);

    expect(mockReq.body).toEqual({
      content: '<a href="safe.com">Link</a><img src="safe.jpg" />',
    });
  });

  it("should only allow YouTube iframes", () => {
    mockReq.body = {
      content:
        "<iframe src='https://evil.com'></iframe><iframe src='https://www.youtube.com/embed/123'></iframe>",
    };

    sanitizeInput(mockReq as Request, mockRes as Response, nextFunction);

    expect(mockReq.body).toEqual({
      content: '<iframe src="https://www.youtube.com/embed/123"></iframe>',
    });
  });
});
