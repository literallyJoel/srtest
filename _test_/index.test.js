const { app } = require("../index");

const request = require("supertest");

const { describe, it, expect, afterAll, beforeAll } = require("@jest/globals");

describe("POST /checkout", () => {
  let server;
  beforeAll(() => {
    server = app.listen(process.env.PORT ?? 8080, () => {
      console.log("Server started on port", process.env.PORT ?? 8080);
    });
  });

  afterAll(() => {
    server.close();
  });
  it("should respond with a bad request on an invalid request body", async () => {
    const res = await request(app).post("/checkout").send({ code: "A" });
    expect(res.status).toBe(400);
  });

  it("should respond with a bad request on an empty request body", async () => {
    const res = await request(app).post("/checkout").send({});
    expect(res.status).toBe(400);
  });

  it("should respond with a bad request on a request body with an invalid item code", async () => {
    const res = await request(app)
      .post("/checkout")
      .send({ code: "L", quantity: 1 });
    expect(res.status).toBe(400);
  });

  it("should respond with a bad request on a request body with a non-numeric quantity", async () => {
    const res = await request(app)
      .post("/checkout")
      .send({ code: "A", quantity: "1" });
    expect(res.status).toBe(400);
  });

  it("should respond with the correct total price and subtotals for a single item", async () => {
    //Usually we'd mock the database calls (or use an in-memory temp database)here but we're using static data
    const res = await request(app)
      .post("/checkout")
      .send({ code: "A", quantity: 1 });
    expect(res.body).toEqual({
      subtotals: [{ code: "A", quantity: 1, subtotal: 50 }],
      total: 50,
    });
    expect(res.status).toBe(200);
  });

  it("should respond with the correct total price and subtotals for multiple items", async () => {
    const res = await request(app)
      .post("/checkout")
      .send([
        { code: "A", quantity: 1 },
        { code: "B", quantity: 1 },
      ]);

    expect(res.body).toEqual({
      subtotals: [
        { code: "A", quantity: 1, subtotal: 50 },
        { code: "B", quantity: 1, subtotal: 35 },
      ],
      total: 85,
    });

    expect(res.status).toBe(200);
  });

  it("Should correctly calculate the total price of a single item code including discounts", async () => {
    const res = await request(app).post("/checkout").send({
      code: "A",
      quantity: 3,
    });

    expect(res.body).toEqual({
      subtotals: [{ code: "A", quantity: 3, subtotal: 140 }],
      total: 140,
    });

    expect(res.status).toBe(200);
  });

  it("Should correctly calculate the total price of multiple item codes including discounts", async () => {
    const res = await request(app)
      .post("/checkout")
      .send([
        { code: "A", quantity: 3 },
        { code: "B", quantity: 2 },
      ]);

    expect(res.body).toEqual({
      subtotals: [
        { code: "A", quantity: 3, subtotal: 140 },
        { code: "B", quantity: 2, subtotal: 60 },
      ],
      total: 200,
    });

    expect(res.status).toBe(200);
  });
});
