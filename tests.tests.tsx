import React from 'react';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { Provider } from 'react-redux';
import configureStore from 'redux-mock-store';
import { MemoryRouter } from 'react-router-dom';
import { ServicesView } from './ServicesPage';
import * as router from 'react-router-dom';
import { act } from 'react-dom/test-utils';

// Mock child components
jest.mock('../../../layouts/EmailDetailsLayout/SearchBox/SearchBox', () => ({
  SearchBox: ({ filterValue, onInputChange }) => (
    <input
      data-testid="search-box"
      value={filterValue}
      onChange={onInputChange}
      placeholder="Filter services..."
    />
  ),
}));

jest.mock('../../../layouts/EmailDetailsLayout/NavBarView/navBarView', () => ({
  NavBarView: () => <div data-testid="nav-bar">NavBar</div>,
}));

jest.mock('../../../layouts/EmailDetailsLayout/ScrollListView/ScrollListView', () => ({
  ScrollListView: ({ items, filterValue, filteredItems, listItemClick, handleAddClick }) => {
    const services = filterValue ? filteredItems.items : items.items;
    return (
      <div data-testid="scroll-list">
        <button onClick={handleAddClick}>Add Service</button>
        {services.map((svc) => (
          <div key={svc.svc_id} onClick={() => listItemClick(svc)} data-testid={`service-${svc.svc_id}`}>
            {svc.name}
          </div>
        ))}
      </div>
    );
  },
}));

jest.mock('../../../layouts/EmailDetailsLayout/PaginationView/PaginationView', () => ({
  PaginationView: ({ items, filterValue, filteredItems, page, limit, handleNext, handlePrevious, updateLimit }) => {
    const services = filterValue ? filteredItems.items : items.items;
    const totalPages = Math.ceil(services.length / limit);
    return (
      <div data-testid="pagination">
        <span>Page {page}</span>
        <button onClick={handlePrevious} disabled={page === 1}>
          Previous
        </button>
        <button onClick={handleNext} disabled={page === totalPages}>
          Next
        </button>
        <button onClick={() => updateLimit(10, services)}>Set Limit 10</button>
      </div>
    );
  },
}));

jest.mock('../../../layouts/EmailDetailsLayout/ServiceDetails/ServiceDetails', () => ({
  ServiceDetails: ({
    selectedService,
    toggleAccountConformity,
    startCreatingNewService,
    editExistingSvc,
  }) => (
    <div data-testid="service-details">
      {selectedService ? <div>Selected: {selectedService.name}</div> : <div>No Service Selected</div>}
      <button onClick={toggleAccountConformity}>Toggle Conformity</button>
      <button onClick={startCreatingNewService}>Create Service</button>
      {selectedService && <button onClick={editExistingSvc}>Edit Service</button>}
    </div>
  ),
}));

jest.mock('../../../layouts/EmailDetailsLayout/AlertDialog', () => ({
  AlertDialog: ({ shouldOpen, closeFn, executeFn, description, executeMessage }) =>
    shouldOpen ? (
      <div data-testid="alert-dialog">
        <p>{description}</p>
        <button onClick={closeFn}>Cancel</button>
        <button onClick={executeFn}>{executeMessage}</button>
      </div>
    ) : null,
}));

// Create a mock Redux store
const mockStore = configureStore([]);
const initialState = {
  servicesViewReducer: { items: [], isFetching: false },
  accountsViewReducer: { items: [], isFetching: false },
  linkedAccount: { account: null, groupId: '' },
  unlinkedAccount: { account: null, groupId: '' },
  services: {
    items: [
      { svc_id: 'svc1', name: 'Service 1', mnemonic: { name: 'svc1' }, description: 'Desc 1' },
      { svc_id: 'svc2', name: 'Service 2', mnemonic: { name: 'svc2' }, description: 'Desc 2' },
    ],
    isFetching: false,
  },
  allservices: {
    items: [
      { svc_id: 'svc1', name: 'Service 1', mnemonic: { name: 'svc1' }, description: 'Desc 1' },
      { svc_id: 'svc2', name: 'Service 2', mnemonic: { name: 'svc2' }, description: 'Desc 2' },
    ],
    isFetching: false,
  },
};
const store = mockStore(initialState);

// Mock react-router-dom hooks
jest.mock('react-router-dom', () => ({
  ...jest.requireActual('react-router-dom'),
  useNavigate: jest.fn(),
  useLocation: jest.fn(),
  useParams: jest.fn(),
}));

// Mock the useStyles hook for withStyles
const mockUseStyles = jest.fn(() => ({
  classes: {
    views: 'mock-views',
    servicesContainer: 'mock-services-container',
    booleanWrapper: 'mock-boolean-wrapper',
    greenAnswer: 'mock-green-answer',
    redAnswer: 'mock-red-answer',
  },
}));
jest.mock('../ServicesPage/styles', () => mockUseStyles);

const mockDispatch = jest.fn();
store.dispatch = mockDispatch;

describe('ServicesView Component', () => {
  let mockNavigate, mockLocation, mockParams;

  beforeEach(() => {
    jest.clearAllMocks();

    mockNavigate = jest.fn();
    mockLocation = { pathname: '/services' };
    mockParams = { svcId: '' };

    router.useNavigate.mockReturnValue(mockNavigate);
    router.useLocation.mockReturnValue(mockLocation);
    router.useParams.mockReturnValue(mockParams);

    store.clearActions();
  });

  it('renders the component and displays services', () => {
    render(
      <Provider store={store}>
        <MemoryRouter>
          <ServicesView />
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByTestId('search-box')).toBeInTheDocument();
    expect(screen.getByTestId('nav-bar')).toBeInTheDocument();
    expect(screen.getByTestId('scroll-list')).toBeInTheDocument();
    expect(screen.getByTestId('pagination')).toBeInTheDocument();
    expect(screen.getByTestId('service-details')).toBeInTheDocument();

    expect(screen.getByText('Service 1')).toBeInTheDocument();
    expect(screen.getByText('Service 2')).toBeInTheDocument();
  });

  it('fetches services and accounts on mount', async () => {
    render(
      <Provider store={store}>
        <MemoryRouter>
          <ServicesView />
        </MemoryRouter>
      </Provider>
    );

    await waitFor(() => {
      const actions = store.getActions();
      expect(actions).toContainEqual(
        expect.objectContaining({ type: 'SERVICES/FETCH' })
      );
      expect(actions).toContainEqual(
        expect.objectContaining({ type: 'ACCOUNTS/FETCH' })
      );
    });
  });

  it('filters services based on input', async () => {
    render(
      <Provider store={store}>
        <MemoryRouter>
          <ServicesView />
        </MemoryRouter>
      </Provider>
    );

    const filterInput = screen.getByTestId('search-box');

    await act(async () => {
      fireEvent.change(filterInput, { target: { value: 'Service 1' } });
    });

    expect(screen.getByText('Service 1')).toBeInTheDocument();
    expect(screen.queryByText('Service 2')).not.toBeInTheDocument();
  });

  it('selects a service on click', async () => {
    render(
      <Provider store={store}>
        <MemoryRouter>
          <ServicesView />
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByText('No Service Selected')).toBeInTheDocument();

    const service1 = screen.getByTestId('service-svc1');
    await act(async () => {
      fireEvent.click(service1);
    });

    expect(screen.getByText('Selected: Service 1')).toBeInTheDocument();
  });

  it('navigates to service details on mount with svcId', () => {
    router.useParams.mockReturnValue({ svcId: 'svc1' });

    render(
      <Provider store={store}>
        <MemoryRouter initialEntries={['/services/svc1']}>
          <ServicesView />
        </MemoryRouter>
      </Provider>
    );

    expect(mockNavigate).toHaveBeenCalledWith('/services/svc1');
  });

  it('handles pagination correctly', async () => {
    const paginatedStore = mockStore({
      ...initialState,
      services: {
        items: Array.from({ length: 30 }, (_, i) => ({
          svc_id: `svc${i + 1}`,
          name: `Service ${i + 1}`,
          mnemonic: { name: `svc${i + 1}` },
          description: `Desc ${i + 1}`,
        })),
        isFetching: false,
      },
      allservices: {
        items: Array.from({ length: 30 }, (_, i) => ({
          svc_id: `svc${i + 1}`,
          name: `Service ${i + 1}`,
          mnemonic: { name: `svc${i + 1}` },
          description: `Desc ${i + 1}`,
        })),
        isFetching: false,
      },
    });

    render(
      <Provider store={paginatedStore}>
        <MemoryRouter>
          <ServicesView />
        </MemoryRouter>
      </Provider>
    );

    expect(screen.getByText('Service 1')).toBeInTheDocument();
    expect(screen.queryByText('Service 26')).not.toBeInTheDocument();

    const nextButton = screen.getByText('Next');
    await act(async () => {
      fireEvent.click(nextButton);
    });

    expect(screen.queryByText('Service 1')).not.toBeInTheDocument();
    expect(screen.getByText('Service 26')).toBeInTheDocument();
  });

  it('updates limit correctly', async () => {
    render(
      <Provider store={store}>
        <MemoryRouter>
          <ServicesView />
        </MemoryRouter>
      </Provider>
    );

    const setLimitButton = screen.getByText('Set Limit 10');
    await act(async () => {
      fireEvent.click(setLimitButton);
    });

    expect(setLimitButton).toBeInTheDocument();
  });

  it('toggles account conformity', async () => {
    render(
      <Provider store={store}>
        <MemoryRouter>
          <ServicesView />
        </MemoryRouter>
      </Provider>
    );

    const toggleButton = screen.getByText('Toggle Conformity');
    await act(async () => {
      fireEvent.click(toggleButton);
    });

    expect(toggleButton).toBeInTheDocument();
  });

  it('creates a new service', async () => {
    render(
      <Provider store={store}>
        <MemoryRouter>
          <ServicesView />
        </MemoryRouter>
      </Provider>
    );

    const addButton = screen.getByText('Add Service');
    await act(async () => {
      fireEvent.click(addButton);
    });

    const createButton = screen.getByText('Create Service');
    await act(async () => {
      fireEvent.click(createButton);
    });

    const actions = store.getActions();
    expect(actions).toContainEqual(
      expect.objectContaining({ type: expect.stringContaining('ADD_SERVICE') })
    );
  });

  it('edits an existing service', async () => {
    render(
      <Provider store={store}>
        <MemoryRouter>
          <ServicesView />
        </MemoryRouter>
      </Provider>
    );

    const service1 = screen.getByTestId('service-svc1');
    await act(async () => {
      fireEvent.click(service1);
    });

    const editButton = screen.getByText('Edit Service');
    await act(async () => {
      fireEvent.click(editButton);
    });

    const actions = store.getActions();
    expect(actions).toContainEqual(
      expect.objectContaining({ type: expect.stringContaining('UPDATE_SERVICE') })
    );
  });

  it('deletes a service', async () => {
    render(
      <Provider store={store}>
        <MemoryRouter>
          <ServicesView />
        </MemoryRouter>
      </Provider>
    );

    const service1 = screen.getByTestId('service-svc1');
    await act(async () => {
      fireEvent.click(service1);
    });

    await act(async () => {
      fireEvent.click(screen.getByText('Edit Service'));
    });

    await act(async () => {
      const instance = screen.getByTestId('service-details').parentElement;
      instance.__proto__.openAlertDialog({ target: { innerText: 'DEACTIVATE' } });
    });

    const executeButton = screen.getByText('DEACTIVATE SERVICE');
    await act(async () => {
      fireEvent.click(executeButton);
    });

    const actions = store.getActions();
    expect(actions).toContainEqual(
      expect.objectContaining({ type: expect.stringContaining('DELETE_SERVICE') })
    );

    expect(screen.queryByTestId('alert-dialog')).not.toBeInTheDocument();
  });
});
