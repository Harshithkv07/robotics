import numpy as np
import pytest
from core.transformations import TransformTree, create_transform_matrix

def check_so3_properties(T):
    assert T.shape == (4, 4)
    R = T[0:3, 0:3]
    # Check orthogonality R^T R = I
    I = np.eye(3)
    assert np.allclose(R.T @ R, I, atol=1e-6)
    # Check det(R) = 1
    assert np.isclose(np.linalg.det(R), 1.0, atol=1e-6)

def test_create_transform_matrix():
    T = create_transform_matrix(1.0, 2.0, np.pi/4)
    check_so3_properties(T)
    assert np.isclose(T[0, 3], 1.0)
    assert np.isclose(T[1, 3], 2.0)

def test_single_trailer_transforms():
    X = np.array([1.0, 2.0, np.pi/6, np.pi/12])
    d1 = 0.5
    L2 = 2.0
    transforms = TransformTree.single_trailer_transforms(X, d1, L2)
    
    for key, T in transforms.items():
        check_so3_properties(T)
        
    assert "world_to_trailer1" in transforms

def test_multi_trailer_transforms():
    X = np.array([1.0, 2.0, np.pi/6, np.pi/12, -np.pi/8])
    transforms = TransformTree.multi_trailer_transforms(X, d1=0.5, L2=2.0, d2=0.5, L3=2.0)
    
    for key, T in transforms.items():
        check_so3_properties(T)
        
    assert "world_to_trailer2" in transforms

def test_json_serializable():
    X = np.array([0.0, 0.0, 0.0, 0.0])
    transforms = TransformTree.single_trailer_transforms(X, 0.5, 2.0)
    json_tree = TransformTree.get_json_serializable_tree(transforms)
    
    # Check if elements are list
    assert isinstance(json_tree["world_to_base"], list)
    assert isinstance(json_tree["world_to_base"][0], list)
