const app = require("../index");
const request = require("supertest");
const { describe, it, expect, afterAll, beforeAll } = require("jest");
describe("GET /", () => {
  let server;
  beforeAll(() => {
    app.listen(process.env.PORT ?? 8080, (_server) => {
      server = _server;
    });
  });

  afterAll(() => {
    server.close();
  });
  it("should respond with a bad request on an invalid request body", async () => {
    const res = await request(app).post("/").send({ code: "A" });
    expect(res.status).toBe(400);
  });

  it("should respond with a bad request on an empty request body", async () => {
    const res = await request(app).post("/").send({});
    expect(res.status).toBe(400);
  });

  it("should respond with a bad request on a request body with an invalid item code", async () => {
    const res = await request(app).post("/").send({ code: "L", quantity: 1 });
    expect(res.status).toBe(400);
  });
});
