import { TRPGGameMap } from '../lib/models/game-map';
import { buildAppContext } from 'test/utils/app';
import { createTestGroup } from 'packages/Group/test/example';
import { getTestUser } from 'packages/Player/test/example';
import { createTestMap } from './example';

const context = buildAppContext();

describe('TRPGGameMap', () => {
  test('TRPGGameMap.createGroupMap should be ok', async () => {
    const testGroup = await createTestGroup();
    const testUser = await getTestUser();

    const groupMap = await TRPGGameMap.createGroupMap(
      testGroup.uuid,
      testUser.uuid,
      'test',
      20,
      15
    );

    try {
      expect(groupMap.groupId).toBe(testGroup.id);
      expect(groupMap.name).toBe('test');
      expect(groupMap.width).toBe(20);
      expect(groupMap.height).toBe(15);
    } finally {
      groupMap.destroy({ force: true });
    }
  });

  test('TRPGGameMap.getGroupMapList should be ok', async () => {
    const testGroup = await createTestGroup();
    const testMap = await createTestMap(testGroup.id);

    const mapList = await TRPGGameMap.getGroupMapList(testGroup.uuid);
    expect(mapList).toHaveLength(1);
    expect(mapList).toHaveProperty([0, 'uuid'], testMap.uuid);
    expect(mapList).toHaveProperty([0, 'name'], testMap.name);
  });
});
