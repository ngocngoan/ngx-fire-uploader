import {
  Component,
  Input,
  OnInit,
  Output,
  OnChanges,
  OnDestroy,
  SimpleChanges,
  EventEmitter,
  TemplateRef,
  ElementRef,
  ChangeDetectionStrategy,
  forwardRef
} from '@angular/core';
import { FileState, FireUploaderProgress, FileItem, FireUploaderRef, FireUploader, ResizeMethod } from '@ngx-fire-uploader/core';
import { BehaviorSubject } from 'rxjs';
import { tap, map, switchMap, take, filter } from 'rxjs/operators';
import { FirePhoto } from './fire-photo.service';
import { ControlValueAccessor, NG_VALUE_ACCESSOR } from '@angular/forms';

export interface FirePhotoState {
  loading?: boolean;
  photo?: string;
  success?: boolean;
  disabled?: boolean;
}

/** For form control usage */
export const PHOTO_UPLOADER_VALUE_ACCESSOR: any = {
  provide: NG_VALUE_ACCESSOR,
  useExisting: forwardRef(() => FirePhotoComponent),
  multi: true,
};

@Component({
  selector: 'fire-photo',
  changeDetection: ChangeDetectionStrategy.OnPush,
  styleUrls: ['./fire-photo.scss'],
  templateUrl: './fire-photo.html',
  providers: [PHOTO_UPLOADER_VALUE_ACCESSOR]
})
export class FirePhotoComponent implements OnInit, OnChanges, OnDestroy, ControlValueAccessor {

  // Local state
  readonly state$ = new BehaviorSubject<FirePhotoState>({loading: false, disabled: false});

  // Fire uploader ref
  uploaderRef: FireUploaderRef;

  // Adds '.fire-photo-hover' class to '.fire-border'
  hover = false;

  onChange: Function;

  // FirePhoto options
  @Input() id = 'root';
  @Input() loadingTemplate: TemplateRef<any>;
  @Input() value: string = this._manager.config.defaultImage;

  @Input() dropZone: boolean = this._manager.config.dropZone;

  // UploaderRef options
  @Input() paramName: string = this._manager.config.paramName;
  @Input() paramDir: string = this._manager.config.paramDir;
  @Input() uniqueName: boolean = this._manager.config.uniqueName;
  @Input() autoStart: boolean = this._manager.config.autoStart;
  @Input() thumbWidth: number = this._manager.config.thumbWidth;
  @Input() thumbHeight: number = this._manager.config.thumbHeight;
  @Input() thumbMethod: ResizeMethod = this._manager.config.thumbMethod;
  @Input() resizeMethod: ResizeMethod = this._manager.config.resizeMethod;
  @Input() resizeWidth: number = this._manager.config.resizeWidth;
  @Input() resizeHeight: number = this._manager.config.resizeHeight;
  @Input() resizeQuality: number = this._manager.config.resizeQuality;

  @Input('disabled') set onDisabled(isDisabled: boolean) {
    this.updateState({disabled: isDisabled});
  }

  // UploaderRef events
  @Output() progress = new EventEmitter<FireUploaderProgress>();
  @Output() file = new EventEmitter<FileItem>();
  @Output() valueChange = new EventEmitter<string>();
  @Output() complete = new EventEmitter();
  @Output() active = new EventEmitter<boolean>();
  @Output() error = new EventEmitter<any>();

  constructor(private _uploader: FireUploader, private _manager: FirePhoto, private _el: ElementRef) {
  }

  private getConfig() {
    return {
      multiple: false,
      accept: 'image/*',
      paramName: this.paramName,
      paramDir: this.paramDir,
      uniqueName: this.uniqueName,
      autoStart: this.autoStart,
      thumbWidth: this.thumbWidth,
      thumbHeight: this.thumbHeight,
      thumbMethod: this.thumbMethod,
      resizeHeight: this.resizeHeight,
      resizeMethod: this.resizeMethod,
      resizeWidth: this.resizeWidth,
      resizeQuality: this.resizeQuality
    };
  }

  ngOnInit() {

    // Auto-set thumb width and height
    if (!this.thumbHeight && !this.thumbWidth) {
      this.thumbWidth = this._el.nativeElement.clientWidth;
      this.thumbHeight = this._el.nativeElement.clientHeight;
    }

    // Get uploader ref and set the config
    this.uploaderRef = this._uploader.ref(this.id, this.getConfig());

    // Get generated thumbnail
    this.uploaderRef.files$.pipe(
      filter((files: FileItem[]) => !!files.length),
      map((files: FileItem[]) => files[0]),
      switchMap((item: FileItem) => {
        this.file.emit(item);
        return item.state$.pipe(
          filter((state: FileState) => !!state.thumbnail),
          take(1),
          tap((state: FileState) =>
            this.updateState({
              photo: state.thumbnail,
              loading: false
            })
          )
        );
      })
    ).subscribe();

    this.uploaderRef.value$.subscribe((downloadURLs: string[]) => {
      this.updateState({photo: downloadURLs[0], success: true});
      this.valueChange.next(downloadURLs[0]);
      // If used as a form control, call onChange function
      if (this.onChange) {
        this.onChange(downloadURLs[0]);
      }
    });

    this.uploaderRef.active$.subscribe((active: boolean) => {
      this.updateState({loading: active});
      this.active.next(active);
    });

    this.uploaderRef.complete$.subscribe((files: FileItem[]) => {
      this.complete.next(files[0]);
      // Reset the uploader on complete
      this.uploaderRef.reset();
    });

    if (this.file.observers.length) {
      this.uploaderRef.files$.subscribe((files: FileItem[]) =>
        this.file.next(files[0])
      );
    }

    if (this.progress.observers.length) {
      this.uploaderRef.progress$.subscribe((progress: FireUploaderProgress) =>
        this.progress.next(progress)
      );
    }

    if (this.error.observers.length) {
      this.uploaderRef.error$.subscribe((err: any) => this.error.next(err));
    }
  }

  ngOnDestroy() {
    this._uploader.destroy(this.id);
  }

  ngOnChanges(changes: SimpleChanges) {
    if (changes['value'] && changes['value'].currentValue !== changes['value'].previousValue) {
      this.updateState({photo: this.value});
    }

    if (this.uploaderRef instanceof FireUploaderRef) {
      // Update uploader's config when inputs change
      this.uploaderRef.setConfig(this.getConfig());
    }
  }

  // Open file dialog
  select() {
    if (!this.state$.value.disabled) {
      this.uploaderRef.select();
    }
  }

  // Start Uploading
  start() {
    this.uploaderRef.start();
  }

  // Pause Uploading
  pause() {
    this.uploaderRef.pause();
  }

  // Resume Uploading
  resume() {
    this.uploaderRef.resume();
  }

  // Reset
  reset() {
    this.uploaderRef.reset();
    if (!this.state$.value.success) {
      this.updateState({photo: this.value});
    }
  }

  updateState(state: FirePhotoState) {
    this.state$.next({...this.state$.value, ...state});
  }

  /**
   * Custom form control functions
   */

  registerOnChange(fn: any): void {
    this.onChange = fn;
  }

  registerOnTouched(fn: any): void {
  }

  setDisabledState(isDisabled: boolean): void {
    this.updateState({disabled: isDisabled});
  }

  writeValue(defaultPhoto: string): void {
    if (defaultPhoto) {
      this.updateState({photo: defaultPhoto});
    }
  }
}
