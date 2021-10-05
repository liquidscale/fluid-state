const scope = require('../src/scope');

let engine = {
    getPlatform: jest.fn().mockResolvedValue({})
};

const rootScopeImpl = jest.fn();

afterEach(function() {
    rootScopeImpl.mockReset();
});

test('scope id should be deduced from factory function name', function() {
    const api = scope({root: jest.fn()}, engine);
    expect(api.id).toEqual('root');
});

test('build scope should return a valid scope instance', async function(){
    rootScopeImpl.mockReturnValue(function() {
        return {schema: {}}
    });

   const api = scope({ root: rootScopeImpl}, engine);
   const scopeInstance = await api.build();
   console.log("built scope instance", scopeInstance);
   expect(engine.getPlatform).toHaveBeenCalled();
});