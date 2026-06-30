/**
 * Returns the nth Fibonacci number.
 *
 * @param n Zero-based position in the Fibonacci sequence.
 * @returns A promise resolving to the Fibonacci number at position n.
 * @throws {TypeError} If n is not a finite integer.
 * @throws {RangeError} If n is negative.
 */
export async function fib(n: number): Promise<number> {
    if (!Number.isFinite(n) || !Number.isInteger(n)) {
        throw new TypeError("n must be a finite integer");
    }

    if (n < 0) {
        throw new RangeError("n must be greater than or equal to 0");
    }

    if (n <= 1) {
        return n;
    }

    const [a, b] = await Promise.all([fib(n - 1), fib(n - 2)]);
    return a + b;
}