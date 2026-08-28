from torchvision import datasets, transforms
import matplotlib.pyplot as plt

transform = transforms.Compose([transforms.Resize((224, 224))])
train_data = datasets.ImageFolder('skintypeDataset/Oily-Dry-Skin-Types/train', transform=transform)

fig, axes = plt.subplots(3, 3, figsize=(8, 8))
for i, ax in enumerate(axes.flat):
    img, label = train_data[i * 300]  # sample spread out images
    ax.imshow(img)
    ax.set_title(train_data.classes[label])
    ax.axis('off')
plt.tight_layout()
plt.savefig('sample_check.png')
print("Saved sample_check.png - open it to view")