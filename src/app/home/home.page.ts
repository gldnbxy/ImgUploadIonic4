import { Component, OnInit, ChangeDetectorRef } from '@angular/core';
import { Camera, CameraOptions, PictureSourceType } from '@ionic-native/Camera/ngx';
import {
  ActionSheetController, ToastController,
  Platform, LoadingController
} from '@ionic/angular';
import { File, FileEntry } from '@ionic-native/File/ngx';
import { HttpClient } from '@angular/common/http';
import { WebView } from '@ionic-native/ionic-webview/ngx';
import { Storage } from '@ionic/storage';
import { FilePath } from '@ionic-native/file-path/ngx';

import { finalize } from 'rxjs/operators';
import { present } from '@ionic/core/dist/types/utils/overlays';
import { CompileShallowModuleMetadata } from '@angular/compiler';

const STORAGE_KEY = 'my_images';


@Component({
  selector: 'app-home',
  templateUrl: 'home.page.html',
  styleUrls: ['home.page.scss'],
})
export class HomePage implements OnInit {

  images = [];
  constructor(private camera: Camera,
    private file: File,
    private http: HttpClient,
    private webview: WebView,
    private actionSheetController: ActionSheetController,
    private toastController: ToastController,
    private storage: Storage,
    private platform: Platform,
    private loadingController: LoadingController,
    private ref: ChangeDetectorRef,
    private filePath: FilePath) { }

  ngOnInit() {
    this.platform.ready().then(() => {
      this.loadStoredImages();
    })
  }

  /**
   * Loads images stored in storage
   */
  loadStoredImages() {
    this.storage.get(STORAGE_KEY).then(images => {
      if (images) {
        let arr = JSON.parse(images);
        this.images = [];
        for (let img of arr) {
          let filePath = this.file.dataDirectory + img;
          let resPath = this.pathForImage(filePath);
          this.images.push({ name: img, path: resPath, filePath: filePath });
          console.log(`The size of your images array is now ${this.images.length}`)
        }
      }
    });
  }

  /**
   * ngl idk yet
   * @param img - Path to the image
   */
  pathForImage(img): string {
    if (img === null)
      return '';
    else {
      let converted = this.webview.convertFileSrc(img);
      return converted;
    }
  }

  /**
   * Presents a toast
   * @param text - Text to present in toast
   */
  async presentToast(text) {
    const toast = await this.toastController.create({
      message: text,
      position: 'bottom',
      duration: 3000
    });
    toast.present();
  }

  /**
   * Presents an actionsheet that allows the user to pick
   * the camera or the photo library
   */
  async selectImage() {

    const actionSheet = await this.actionSheetController.create({
      header: 'Select Image source',
      buttons: [{
        text: 'Load from Library',
        handler: () => {
          this.takePicture(this.camera.PictureSourceType.PHOTOLIBRARY);
        }
      },
      {
        text: 'Use Camera',
        handler: () => {
          this.takePicture(this.camera.PictureSourceType.CAMERA);
        }
      },
      {
        text: 'Cancel',
        role: 'cancel'
      }]
    });
    await actionSheet.present();
  }

  /**
   * Gets the picture from Camera or library based on user choice
   * @param sourceType - Camera picture source type (camera or lib)
   */
  takePicture(sourceType: PictureSourceType) {
    let options: CameraOptions = {
      quality: 100,
      destinationType: this.camera.DestinationType.FILE_URI,
      sourceType: sourceType,
      encodingType: this.camera.EncodingType.JPEG,
      saveToPhotoAlbum: false,
      correctOrientation: true
    };

    this.camera.getPicture(options).then(imagePath => {
      if (this.platform.is('android') && sourceType === this.camera.PictureSourceType.PHOTOLIBRARY) {
        this.copyImgAndroid(imagePath);
      }
      else {
        let currentName = imagePath.substr(imagePath.lastIndexOf('/') + 1);
        let correctPath = imagePath.substr(0, imagePath.lastIndexOf('/') + 1);
        this.copyFileToLocalDir(correctPath, currentName, this.createFileName());
      }
    });
  }

  /**
   * Android specific function to copy picture from library to
   * app directory
   * @param imagePath - The file uri
   */
  copyImgAndroid(imagePath) {
    this.file.resolveLocalFilesystemUrl(imagePath).then(entry => {

      this.file.resolveDirectoryUrl(this.file.dataDirectory)
        .then(dirEntry => {
          let fileName = this.createFileName()
          entry.copyTo(dirEntry, fileName);
          this.updateStoredImages(fileName);
        }, err => {
          console.log(`Error while resolving working directory\n${err}`)
        });
    }, err => {
      console.log(`Error while resolving filesystem URL ${err}`)
    });
  }

  /**
   * Helper function to create a new name for an image 
   */
  createFileName() {
    let d = new Date(),
      n = d.getTime(),
      newFileName = n + '.jpg';
    return newFileName;
  }


  /**
   * Copies file from camera or library to app directory
   * @param namePath - Base FileSystem
   * @param currentName - Name of file to copy
   * @param newFileName - Name of copied file
   */
  copyFileToLocalDir(namePath, currentName, newFileName) {
    this.file.copyFile(namePath, currentName, this.file.dataDirectory, newFileName)
      .then(res => {
        this.updateStoredImages(newFileName);
      }, err => {
        this.presentToast('Error while storing file.');
        console.log(err);
      });
  }

  /**
   * Update array of images with images from local storage
   * @param name - Name of file in app directory
   */
  updateStoredImages(name) {
    this.storage.get(STORAGE_KEY).then(images => {
      let arr = JSON.parse(images);
      if (!arr) {
        let newImages = [name];
        this.storage.set(STORAGE_KEY, JSON.stringify(newImages));
      }
      else {
        arr.push(name);
        this.storage.set(STORAGE_KEY, JSON.stringify(arr));
      }

      let filePath = this.file.dataDirectory + name;
      let resPath = this.pathForImage(filePath);

      let newEntry = {
        name: name,
        path: resPath,
        filePath: filePath
      };

      this.images = [newEntry, ...this.images];
      this.ref.detectChanges();
    });
  }

  /**
   * Deletes image from local storage and app directory
   * @param imgEntry - 
   * @param position -
   */
  deleteImage(imgEntry, position) {
    this.images.splice(position, 1);

    this.storage.get(STORAGE_KEY).then(images => {
      let arr = JSON.parse(images);
      let filtered = arr.silter(name => name != imgEntry.name);
      this.storage.set(STORAGE_KEY, JSON.stringify(filtered));

      let correctPath = imgEntry.filePath.substr(0, imgEntry.filePath.lastIndexOf('/') + 1);
      this.file.removeFile(correctPath, imgEntry.name).then(res => {
        this.presentToast('File removed.');
      });
    });
  }

  // Don't really use this
  startUpload(imgEntry) {
    this.file.resolveLocalFilesystemUrl(imgEntry.filePath).then(entry => {
      (<FileEntry>entry).file(file => this.readFile(file));
    }).catch(err => {
      this.presentToast('Error while reading file.');
    });
  }

  // Or this
  readFile(file: any) {
    const reader = new FileReader();
    reader.onloadend = () => {
      const formData = new FormData();
      const imgBlob = new Blob([reader.result], {
        type: file.type
      });
      formData.append('file', imgBlob, file.name);
      this.uploadImageData(formData);
    };
    reader.readAsArrayBuffer(file);
  }

  // Or this
  async uploadImageData(formData: FormData) {
    const loading = await this.loadingController.create({
      message: 'Uploading image...'
    });
    await loading.present();

    this.http.post('http://localhost:8000/upload', formData)
      .pipe(
        finalize(() => {
          loading.dismiss();
        })
      ).subscribe(res => {
        if (res['sucesss'])
          this.presentToast('File upload complete.');
        else
          this.presentToast('File upload failed');
      });
  }
}
