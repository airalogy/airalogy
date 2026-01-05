# Fix: Assigner State Mutation Bug and Add Topological Sort

## 🐛 Problem Description

### Issue 1: State Mutation Bug in `get_dependent_fields_of_assigned_key()`

The current implementation directly modifies the internal dependency list:

```python
# Before (buggy)
dependent_keys = cls.assigned_info[assigned_key][0]  # Direct reference!
for key in dependent_keys:
    dependent_keys.extend(...)  # Modifies the original list!
```

**Consequence**: Each call pollutes the internal state, causing the dependency list to grow infinitely:

```
Initial:     ['x', 'c']
After call 1: ['x', 'c', 'a', 'b']
After call 2: ['x', 'c', 'a', 'b', 'a', 'b']
After call 3: ['x', 'c', 'a', 'b', 'a', 'b', 'a', 'b']
...
```

### Issue 2: No Topological Sort in `assign()`

The `assign()` method uses simple recursion without:
- Proper execution order guarantee
- Redundant computation prevention
- Cycle detection

This causes issues in complex dependency graphs (e.g., diamond dependencies):

```
    a
   / \
  b   c
   \ /
    d
```

Field `d` might be computed with stale values, or intermediate fields computed multiple times.

## ✅ Solution

### 1. Fix State Mutation

```python
# After (fixed)
dependent_keys = list(cls.assigned_info[assigned_key][0])  # Create copy
result = dependent_keys[:]
for key in dependent_keys:
    result.extend(...)  # Modify the copy
```

### 2. Add Topological Sort to `assign()`

- Implemented Kahn's algorithm for topological sorting
- Added `computed` set to track already-computed fields
- New `_get_execution_order()` method for proper ordering

### 3. New `DependencyGraph` Module

A comprehensive dependency graph manager providing:

| Feature | Method |
|---------|--------|
| Cycle Detection | `graph.validate()` |
| Topological Sort | `graph.get_topological_order()` |
| Execution Order | `graph.get_execution_order(field)` |
| Affected Fields | `graph.get_affected_fields(changed)` |
| Dirty Tracking | `mark_dirty()` / `is_dirty()` / `clear_dirty()` |
| Visualization | `graph.visualize()` → Mermaid diagram |

## 📊 Test Results

### Before Fix (pip installed version)
```
Initial old_y deps: ['old_x', 'old_c']
After call 1: ['old_x', 'old_c', 'old_a', 'old_b']
After call 2: ['old_x', 'old_c', 'old_a', 'old_b', 'old_a', 'old_b']
After call 3: ['old_x', 'old_c', 'old_a', 'old_b', 'old_a', 'old_b', 'old_a', 'old_b']
❌ Internal state polluted!
```

### After Fix
```
Initial new_y deps: ['new_x', 'new_c']
After call 1: ['new_x', 'new_c']
After call 2: ['new_x', 'new_c']
After call 3: ['new_x', 'new_c']
✅ Internal state unchanged!
```

### Complex Graph (Line F) Execution
```
======================================================================
⏱️  Start computation
======================================================================
  [   5.75ms] ✓ f_f6  =    7 (5.68ms)
  [  12.15ms] ✓ f_f7  =   20 (6.25ms)
  [  18.56ms] ✓ f_f8  =   13 (6.29ms)
  [  24.91ms] ✓ f_f9  =  140 (6.19ms)
  [  30.75ms] ✓ f_f10 =  153 (5.79ms)
  [  37.15ms] ✓ f_f11 =  306 (6.27ms)
  [  43.48ms] ✓ f_f12 =  313 (6.27ms)
  [  49.80ms] ✓ f_f13 =  333 (6.27ms)
  [  55.74ms] ✓ f_f14 =  346 (5.89ms)
  [  61.38ms] ✓ f_f15 =  343 (5.59ms)
======================================================================
✅ Completed in 61.46ms, 10 steps
✅ Each field computed exactly once!
======================================================================
```

## 🧪 New Tests Added

1. **test_assigner_state_mutation.py** - Verifies internal state is not polluted
2. **test_assign_execution.py** - Verifies no redundant computation  
3. **test_dependency_graph.py** - Tests the new DependencyGraph module

All 29 tests pass:
```
tests/test_assigner.py: 7 passed
tests/test_assigner_state_mutation.py: 5 passed
tests/test_assign_execution.py: 5 passed
tests/test_dependency_graph.py: 16 passed
tests/test_rv_table_assigner.py: 1 passed
```

## 📝 Files Changed

- `src/airalogy/assigner/assigner_base.py` - Bug fixes and topological sort
- `src/airalogy/assigner/dependency_graph.py` - New module (added)
- `src/airalogy/assigner/__init__.py` - Export new classes
- `tests/test_assigner_state_mutation.py` - New tests (added)
- `tests/test_assign_execution.py` - New tests (added)
- `tests/test_dependency_graph.py` - New tests (added)

## 🔄 Backward Compatibility

All existing tests pass. The API remains unchanged - this is a bug fix and internal improvement.

## 🎯 Frontend Integration Best Practices

The fixes ensure that frontend trigger mechanisms won't cause infinite loops:

### Key Mechanisms

| Mechanism | Purpose |
|-----------|---------|
| **Backend Topological Sort** | Guarantees correct computation order; single `assign()` handles entire dependency chain |
| **Value Change Detection** | Skip trigger when `old == new` |
| **Computation Lock** | Block new triggers during computation |
| **Dirty Marking + Batch Compute** | Collect all changes, compute once |

### Recommended Frontend Pattern

```python
class FrontendSimulator:
    def __init__(self):
        self.values = {}
        self.dirty_fields = set()
    
    def user_edit(self, field, value):
        if self.values.get(field) == value:
            return  # No change, skip
        
        self.values[field] = value
        
        # Mark affected fields as dirty
        affected = DefaultAssigner.get_assigned_fields_of_dependent_key(field)
        for f in affected:
            info = DefaultAssigner.assigned_info.get(f)
            if info and info[2] in ("auto", "auto_readonly"):
                self.dirty_fields.add(f)
    
    def flush(self):
        """Batch compute all dirty fields (call after debounce)"""
        # Iterate until all dependencies are resolved
        while self.dirty_fields:
            to_compute = list(self.dirty_fields)
            self.dirty_fields.clear()
            
            for target in to_compute:
                result = DefaultAssigner.assign(target, self.values.copy())
                if result.success:
                    self.values.update(result.assigned_fields)
```

### Why No Infinite Loops?

1. **True cyclic dependencies** (e.g., `a → b → c → a`) are detected at registration time by `DependencyGraph.validate()`
2. **Value change detection** prevents `set(5) → set(5)` from triggering
3. **Topological sort** ensures each field is computed exactly once per batch
4. **Computation lock** prevents re-entry during calculation
