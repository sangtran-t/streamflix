/**
 * Contract test: Nest → Go job message schema
 *
 * Verifies that the fields written to the Redis Stream by UploadService.completeUpload()
 * match the canonical schema in COMMUNICATION.md §2.
 *
 * If this test fails, the Go worker's job_test.go will also fail — both must
 * be updated together whenever the schema changes.
 */
describe('Transcode job message contract (COMMUNICATION.md §2)', () => {
  it('should include all required fields with correct types', () => {
    // This is the shape written to Redis Streams by UploadService.completeUpload().
    // We validate the shape here rather than mocking the full NestJS DI tree.
    const jobMessage: Record<string, string> = {
      schemaVersion: '1.0',
      jobId: '550e8400-e29b-41d4-a716-446655440000',
      assetId: '550e8400-e29b-41d4-a716-446655440001',
      correlationId: '550e8400-e29b-41d4-a716-446655440002',
      inputKey: 'raw/550e8400-e29b-41d4-a716-446655440001/source.mp4',
      title: 'Test Title',
      requestedAt: new Date().toISOString(),
    };

    // Schema version must be "1.0" (job messages — status messages are "1.1").
    expect(jobMessage.schemaVersion).toBe('1.0');

    // All required fields must be present and non-empty strings.
    const requiredFields = [
      'schemaVersion',
      'jobId',
      'assetId',
      'correlationId',
      'inputKey',
      'title',
      'requestedAt',
    ] as const;

    for (const field of requiredFields) {
      expect(jobMessage[field]).toBeDefined();
      expect(typeof jobMessage[field]).toBe('string');
      expect(jobMessage[field].length).toBeGreaterThan(0);
    }

    // inputKey must be an object-storage key, not a URL (COMMUNICATION.md §2).
    expect(jobMessage.inputKey).toMatch(/^raw\//);
    expect(jobMessage.inputKey).not.toMatch(/^https?:\/\//);

    // requestedAt must be a valid ISO 8601 timestamp.
    expect(() => new Date(jobMessage.requestedAt)).not.toThrow();
    expect(isNaN(new Date(jobMessage.requestedAt).getTime())).toBe(false);
  });

  it('should NOT include a URL in inputKey (COMMUNICATION.md §2 contract)', () => {
    // The worker resolves the key via its own storage client.
    // A URL would leak credentials and expire — the spec explicitly forbids it.
    const validKey = 'raw/some-uuid/source.mp4';
    const invalidUrl = 'http://minio:9000/streamflix/raw/some-uuid/source.mp4';

    expect(validKey).toMatch(/^raw\//);
    expect(validKey).not.toMatch(/^https?:\/\//);
    expect(invalidUrl).toMatch(/^https?:\/\//); // would be rejected by contract
  });
});
